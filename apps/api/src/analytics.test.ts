import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_EDIT_SCOPE,
  AnalyticsAccess,
  GoogleAnalyticsReadClient,
  GoogleAnalyticsWriteClient,
  googleAnalyticsReadsEnabled,
  googleAnalyticsWritesEnabled,
} from "./analytics.js";

function analyticsFetch(eventCounts: number[]) {
  let countIndex = 0;
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/accountSummaries")) {
      return Response.json({
        accountSummaries: [{
          account: "accounts/1",
          displayName: "ConsentFlow Verification",
          propertySummaries: [{ property: "properties/550074997", displayName: "ConsentFlow Verification" }],
        }],
      });
    }
    if (url.pathname.endsWith("/dataStreams")) {
      return Response.json({
        dataStreams: [{
          name: "properties/550074997/dataStreams/15443100029",
          displayName: "ConsentFlow web",
          type: "WEB_DATA_STREAM",
          webStreamData: { measurementId: "G-YV879ECLRV" },
        }],
      });
    }
    if (url.pathname.endsWith(":runRealtimeReport") && init?.method === "POST") {
      const count = eventCounts[Math.min(countIndex++, eventCounts.length - 1)] ?? 0;
      return Response.json({
        rows: count === 0 ? [] : [{ dimensionValues: [{ value: "generate_lead" }], metricValues: [{ value: String(count) }] }],
      });
    }
    return Response.json({ error: { message: "unexpected" } }, { status: 500 });
  });
}

describe("read-only Google Analytics verification", () => {
  it("requires an exact enable flag", () => {
    expect(googleAnalyticsReadsEnabled({})).toBe(false);
    expect(googleAnalyticsReadsEnabled({ GOOGLE_ANALYTICS_READS_ENABLED: "TRUE" })).toBe(false);
    expect(googleAnalyticsReadsEnabled({ GOOGLE_ANALYTICS_READS_ENABLED: "true" })).toBe(true);
  });

  it("confirms only when the same property's realtime event count increases", async () => {
    const fetcher = analyticsFetch([4, 4, 5]);
    const client = new GoogleAnalyticsReadClient(
      async () => "access-token",
      fetcher,
      true,
      () => Date.parse("2026-08-23T18:00:00.000Z"),
      () => "verification-123",
    );

    const started = await client.start({ measurementId: "g-yv879eclrv", eventName: "generate_lead" });
    expect(started).toMatchObject({
      status: "started",
      verificationId: "verification-123",
      measurementId: "G-YV879ECLRV",
      eventName: "generate_lead",
      baselineEventCount: 4,
      property: { propertyId: "550074997", name: "ConsentFlow Verification" },
      stream: { streamId: "15443100029", name: "ConsentFlow web" },
    });
    await expect(client.confirm("verification-123")).resolves.toMatchObject({
      status: "pending",
      baselineEventCount: 4,
      currentEventCount: 4,
    });
    await expect(client.confirm("verification-123")).resolves.toMatchObject({
      status: "confirmed",
      baselineEventCount: 4,
      currentEventCount: 5,
    });
  });

  it("fails closed for disabled reads, ambiguous streams, and expired verification", async () => {
    const disabled = new GoogleAnalyticsReadClient(async () => "token", vi.fn<typeof fetch>(), false);
    await expect(disabled.start({ measurementId: "G-YV879ECLRV", eventName: "generate_lead" }))
      .rejects.toMatchObject({ status: 403, code: "reads_disabled" });

    const ambiguousFetch = analyticsFetch([0]);
    ambiguousFetch.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{
        account: "accounts/1",
        displayName: "Account",
        propertySummaries: [
          { property: "properties/1", displayName: "First" },
          { property: "properties/2", displayName: "Second" },
        ],
      }],
    })).mockImplementationOnce(async () => Response.json({ dataStreams: [{
      name: "properties/1/dataStreams/1",
      displayName: "First",
      webStreamData: { measurementId: "G-YV879ECLRV" },
    }] })).mockImplementationOnce(async () => Response.json({ dataStreams: [{
      name: "properties/2/dataStreams/2",
      displayName: "Second",
      webStreamData: { measurementId: "G-YV879ECLRV" },
    }] }));
    const ambiguous = new GoogleAnalyticsReadClient(async () => "token", ambiguousFetch, true);
    await expect(ambiguous.start({ measurementId: "G-YV879ECLRV", eventName: "generate_lead" }))
      .rejects.toMatchObject({ status: 409, code: "measurement_ambiguous" });

    let now = 1_000;
    const expiring = new GoogleAnalyticsReadClient(
      async () => "token",
      analyticsFetch([0]),
      true,
      () => now,
      () => "expiring-verification",
    );
    await expiring.start({ measurementId: "G-YV879ECLRV", eventName: "generate_lead" });
    now += 11 * 60 * 1_000;
    await expect(expiring.confirm("expiring-verification")).rejects.toMatchObject({ status: 410, code: "verification_expired" });
  });

  it("distinguishes a provider denial from the local read gate", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{ propertySummaries: [{ property: "properties/1", displayName: "Property" }] }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/1/dataStreams/1",
        displayName: "Stream",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async () => Response.json({
      error: { status: "PERMISSION_DENIED" },
    }, { status: 403 }));
    const client = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);

    await expect(client.start({ measurementId: "G-YV879ECLRV", eventName: "generate_lead" }))
      .rejects.toMatchObject({ status: 502, code: "provider_forbidden" });
  });

  it("reports enhanced-measurement readiness for one exact web stream", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{
        propertySummaries: [{ property: "properties/550074997", displayName: "ConsentFlow Verification" }],
      }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/550074997/dataStreams/15443100029",
        displayName: "ConsentFlow web",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async (input, init) => {
      expect(input.toString()).toBe(
        "https://analyticsadmin.googleapis.com/v1alpha/properties/550074997/dataStreams/15443100029/enhancedMeasurementSettings",
      );
      expect(init?.method).toBeUndefined();

      return Response.json({
        streamEnabled: true,
        scrollsEnabled: true,
        outboundClicksEnabled: true,
        siteSearchEnabled: false,
        videoEngagementEnabled: true,
        fileDownloadsEnabled: true,
        pageChangesEnabled: true,
        formInteractionsEnabled: false,
      });
    });
    const client = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);

    await expect(client.enhancedMeasurement("g-yv879eclrv")).resolves.toEqual({
      measurementId: "G-YV879ECLRV",
      property: { propertyId: "550074997", name: "ConsentFlow Verification" },
      stream: { streamId: "15443100029", name: "ConsentFlow web" },
      settings: {
        stream: true,
        pageViews: true,
        scrolls: true,
        outboundClicks: true,
        siteSearch: false,
        videoEngagement: true,
        fileDownloads: true,
        formInteractions: false,
      },
    });
  });

  it("decodes omitted protobuf booleans as false", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{ propertySummaries: [{ property: "properties/1", displayName: "Property" }] }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/1/dataStreams/2",
        displayName: "Stream",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async () => Response.json({ streamEnabled: true }));
    const client = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);

    await expect(client.enhancedMeasurement("G-YV879ECLRV")).resolves.toMatchObject({
      settings: {
        stream: true,
        pageViews: false,
        scrolls: false,
        outboundClicks: false,
        siteSearch: false,
        videoEngagement: false,
        fileDownloads: false,
        formInteractions: false,
      },
    });
  });

  it("rejects non-boolean enhanced-measurement settings", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{ propertySummaries: [{ property: "properties/1", displayName: "Property" }] }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/1/dataStreams/2",
        displayName: "Stream",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async () => Response.json({ streamEnabled: "yes" }));
    const client = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);

    await expect(client.enhancedMeasurement("G-YV879ECLRV"))
      .rejects.toMatchObject({ status: 502, code: "malformed_provider_response" });
  });
});

describe("guarded enhanced-measurement writes", () => {
  it("requires an exact write flag", () => {
    expect(googleAnalyticsWritesEnabled({})).toBe(false);
    expect(googleAnalyticsWritesEnabled({ GOOGLE_ANALYTICS_WRITES_ENABLED: "TRUE" })).toBe(false);
    expect(googleAnalyticsWritesEnabled({ GOOGLE_ANALYTICS_WRITES_ENABLED: "true" })).toBe(true);
    expect(ANALYTICS_EDIT_SCOPE).toBe("https://www.googleapis.com/auth/analytics.edit");
  });

  it("fails before reading when writes are disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const reader = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);
    const writer = new GoogleAnalyticsWriteClient(
      reader,
      async () => "token",
      fetcher,
      AnalyticsAccess.Read,
    );

    await expect(writer.enableMeasurement("G-YV879ECLRV"))
      .rejects.toMatchObject({ status: 403, code: "writes_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fresh-reads the exact stream and updates only the master switch", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{
        propertySummaries: [{ property: "properties/550074997", displayName: "ConsentFlow Verification" }],
      }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/550074997/dataStreams/15443100029",
        displayName: "ConsentFlow web",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async () => Response.json({
      streamEnabled: false,
      pageChangesEnabled: true,
      scrollsEnabled: true,
      outboundClicksEnabled: true,
      siteSearchEnabled: true,
      videoEngagementEnabled: true,
      fileDownloadsEnabled: true,
      formInteractionsEnabled: true,
    })).mockImplementationOnce(async (input, init) => {
      const url = new URL(input.toString());
      expect(url.toString()).toBe(
        "https://analyticsadmin.googleapis.com/v1alpha/properties/550074997/dataStreams/15443100029/enhancedMeasurementSettings?updateMask=stream_enabled",
      );
      expect(init?.method).toBe("PATCH");
      expect(init?.headers).toEqual({
        Authorization: "Bearer write-token",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        name: "properties/550074997/dataStreams/15443100029/enhancedMeasurementSettings",
        streamEnabled: true,
      });

      return Response.json({ streamEnabled: true });
    });
    const reader = new GoogleAnalyticsReadClient(async () => "read-token", fetcher, true);
    const writer = new GoogleAnalyticsWriteClient(
      reader,
      async () => "write-token",
      fetcher,
      AnalyticsAccess.Edit,
    );

    await expect(writer.enableMeasurement("g-yv879eclrv")).resolves.toMatchObject({
      status: "enabled",
      audit: {
        measurementId: "G-YV879ECLRV",
        property: { propertyId: "550074997" },
        stream: { streamId: "15443100029" },
        settings: { stream: true, outboundClicks: true, formInteractions: true },
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("does not patch an already-enabled stream", async () => {
    const fetcher = analyticsFetch([0]);
    fetcher.mockImplementationOnce(async () => Response.json({
      accountSummaries: [{ propertySummaries: [{ property: "properties/1", displayName: "Property" }] }],
    })).mockImplementationOnce(async () => Response.json({
      dataStreams: [{
        name: "properties/1/dataStreams/2",
        displayName: "Stream",
        webStreamData: { measurementId: "G-YV879ECLRV" },
      }],
    })).mockImplementationOnce(async () => Response.json({ streamEnabled: true }));
    const reader = new GoogleAnalyticsReadClient(async () => "token", fetcher, true);
    const writer = new GoogleAnalyticsWriteClient(
      reader,
      async () => "token",
      fetcher,
      AnalyticsAccess.Edit,
    );

    await expect(writer.enableMeasurement("G-YV879ECLRV"))
      .resolves.toMatchObject({ status: "already_enabled", audit: { settings: { stream: true } } });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
