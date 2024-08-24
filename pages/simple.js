import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import moment from "moment";
import ResponsiveTable from "@monaco/components/ResponsiveTable";
import Driver, { TableHeader } from "@monaco/components/simple/Driver";
import Input from "@monaco/components/Input";

const sortPosition = (a, b) => {
  const [, aLine] = a;
  const [, bLine] = b;
  const aPos = Number(aLine.Position);
  const bPos = Number(bLine.Position);
  return aPos - bPos;
};

const sortUtc = (a, b) => {
  const aDate = moment.utc(a.Utc);
  const bDate = moment.utc(b.Utc);
  return bDate.diff(aDate);
};

const getFlagColour = (flag) => {
  switch (flag?.toLowerCase()) {
    case "green":
      return { bg: "green" };
    case "yellow":
    case "double yellow":
      return { bg: "yellow", fg: "var(--colour-bg)" };
    case "red":
      return { bg: "red" };
    case "blue":
      return { bg: "blue" };
    default:
      return { bg: "transparent" };
  }
};

const getElapsedTime = (eventTime) => {
  const diff = moment.utc().diff(moment.utc(eventTime), 'seconds');
  return diff > 3600 ? "--:--" : moment.utc(diff * 1000).format('mm:ss');
};

const createExtraMsgSpans = (message, driverList) => {
  for (var racingNumber in driverList) {
    var driver = driverList[racingNumber];
    message = message.replace(new RegExp(`\\(${driver.Tla}\\)`, 'g'), `(<span style="color: black; backgroundColor: #${driver.TeamColour}">${driver.Tla}</span>)`)
  };

  message = message.replace(new RegExp("penalty|deleted", 'gi'), '<span style="backgroundColor: darkred">$&</span>')

  const elements = [];
  const regex = /<span style="([^"]+)">([^<]+)<\/span>|([^<]+)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    if (match[1] && match[2]) {
      const styles = match[1].split(';').reduce((acc, style) => {
        const [key, value] = style.split(':').map(s => s.trim());
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {});

      elements.push(
        <span key={elements.length} style={styles}>
          {match[2]}
        </span>
      );
    } else if (match[3]) {
      elements.push(match[3]);
    }
  }

  return <>{elements}</>;
}

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [liveState, setLiveState] = useState({});
  const [updated, setUpdated] = useState(new Date());
  const [delayMs, setDelayMs] = useState(0);
  const [delayTarget, setDelayTarget] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [triggerConnection, setTriggerConnection] = useState(0);
  const [triggerTick, setTriggerTick] = useState(0);

  const socket = useRef();
  const retry = useRef();

  const initWebsocket = (handleMessage) => {
    if (retry.current) {
      clearTimeout(retry.current);
      retry.current = undefined;
    }

    const wsUrl =
      `${window.location.protocol.replace("http", "ws")}//` +
      window.location.hostname +
      (window.location.port ? `:${window.location.port}` : "") +
      "/ws";

    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      setConnected(true);
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      setBlocking((isBlocking) => {
        if (!retry.current && !isBlocking)
          retry.current = window.setTimeout(() => {
            initWebsocket(handleMessage);
          }, 1000);
      });
    });

    ws.addEventListener("error", () => {
      ws.close();
    });

    ws.addEventListener("message", ({ data }) => {
      setTimeout(() => {
        handleMessage(data);
      }, delayMs);
    });

    socket.current = ws;
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/worker.js");
    }
  }, []);

  useEffect(() => {
    setLiveState({});
    setBlocking(false);
    initWebsocket((data) => {
      try {
        const d = JSON.parse(data);
        setLiveState(d);
        setUpdated(new Date());
      } catch (e) {
        console.error(`could not process message: ${e}`);
      }
    });
  }, [triggerConnection]);

  useEffect(() => {
    if (blocking) {
      socket.current?.close();
      setTimeout(() => {
        setTriggerConnection((n) => n + 1);
      }, 100);
    }
  }, [blocking]);

  useEffect(() => {
    let interval;
    if (Date.now() < delayTarget) {
      interval = setInterval(() => {
        setTriggerTick((n) => n + 1);
        if (Date.now() >= delayTarget) clearInterval(interval);
      }, 250);
    }
  }, [delayTarget]);

  const messages = Object.values(liveState?.RaceControlMessages?.Messages ?? []);
  const filteredMessages = messages.filter(item => item.Flag?.toLowerCase() !== "blue");
  const messageCount = filteredMessages.length;
  useEffect(() => {
    if (messageCount > 0) {
      try {
        new Audio("/notif-beep.mp3").play();
      } catch (e) {}
    }
  }, [messageCount]);

  if (!connected)
    return (
      <>
        <Head>
          <title>No connection</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ marginBottom: "var(--space-4)" }}>
              <strong>NO CONNECTION</strong>
            </p>
            <button onClick={() => window.location.reload()}>RELOAD</button>
          </div>
        </main>
      </>
    );

  if (Date.now() < delayTarget)
    return (
      <>
        <Head>
          <title>Syncing</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ marginBottom: "var(--space-4)" }}>
              <strong>SYNCING...</strong>
            </p>
            <p>{(delayTarget - Date.now()) / 1000} sec</p>
          </div>
        </main>
      </>
    );

  const {
    Heartbeat,
    SessionInfo,
    TrackStatus,
    LapCount,
    ExtrapolatedClock,
    WeatherData,
    DriverList,
    SessionData,
    SessionStatus,
    RaceControlMessages,
    TimingData,
    TimingAppData,
    TimingStats,
    CarData,
    Position,
    TeamRadio,
  } = liveState;

  if (!Heartbeat)
    return (
      <>
        <Head>
          <title>No session</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ marginBottom: "var(--space-4)" }}>
              <strong>NO SESSION</strong>
            </p>
            <p>Come back later when there is a live session</p>
          </div>
        </main>
      </>
    );

  const extrapolatedTimeRemaining =
    ExtrapolatedClock.Utc && ExtrapolatedClock.Remaining
      ? ExtrapolatedClock.Extrapolating
        ? moment
            .utc(
              Math.max(
                moment
                  .duration(ExtrapolatedClock.Remaining)
                  .subtract(
                    moment.utc().diff(moment.utc(ExtrapolatedClock.Utc))
                  )
                  .asMilliseconds() + delayMs,
                0
              )
            )
            .format("HH:mm:ss")
        : ExtrapolatedClock.Remaining
      : undefined;

  return (
    <>
      <Head>
        <title>
          {SessionInfo.Meeting.Circuit.ShortName}: {SessionInfo.Name}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{
        width: "100vw",
        height: "100vh",
      }}>
        
          <div
            style={{
              fontSize: "5vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-3)",
              borderBottom: "1px solid var(--colour-border)",
              overflow: "auto",
              height: "10vh",
              backgroundColor: getFlagColour(TrackStatus.Message).bg,
              color: getFlagColour(TrackStatus.Message).fg ?? "var(--colour-fg)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "left",
              }}
            >
              {!!TrackStatus && (
                <p style={{ marginRight: "var(--space-4)"}}>
                  <p>{TrackStatus.Message}|{SessionStatus.Status}</p>
                </p>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              {!!LapCount && (
                <p>
                  <p>{LapCount.CurrentLap}/{LapCount.TotalLaps}</p>
                </p>
              )} 
              {!!LapCount && (
                <p style={{ marginLeft: "var(--space-4)", marginRight: "var(--space-4)" }}>|</p>
              )}
              {!!extrapolatedTimeRemaining && (
                <p>
                  <p>{extrapolatedTimeRemaining}</p>
                </p>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "right",
              }}
            >
              <p>
                <p>{moment(updated).format("HH:mm:ss")}</p>
              </p>
            </div>
          </div>

        <ResponsiveTable
          style={{
            borderBottom: "1px solid var(--colour-border)",
            width: "100vw",
            height: "90vh",
            display: "flex"
          }}
        >
          <div
            style={{
              fontSize: "3vw",
              width: "55%",
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid var(--colour-border)",
            }}
          >
            {!!RaceControlMessages ? (
              <ul
                style={{
                  listStyle: "none",
                  overflowY: "scroll",
                  scrollbarWidth: "none",
                  flexGrow: 1,
                }}
              >
                {[
                  ...Object.values(RaceControlMessages.Messages),
                  ...Object.values(SessionData.StatusSeries),
                ]
                  .sort(sortUtc)
                  .filter(event => event.Flag?.toLowerCase() !== "blue")
                  .map((event, i) => (
                    <li
                      key={`race-control-${event.Utc}-${i}`}
                      style={{ padding: "var(--space-3)", display: "flex" }}
                    >
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          marginRight: "var(--space-4)",
                          fontSize: "2vw",
                          borderRight: "0.3vw solid var(--colour-border)",
                          paddingRight: "var(--space-3)"
                        }}
                      >
                        {getElapsedTime(event.Utc)}
                      </span>
                      {event.Category === "Flag" && (
                        <span
                          style={{
                            backgroundColor: getFlagColour(event.Flag).bg,
                            color:
                              getFlagColour(event.Flag).fg ??
                              "var(--colour-fg)",
                            border: "1px solid var(--colour-border)",
                            borderRadius: "var(--space-1)",
                            padding: "0 var(--space-2)",
                            marginRight: "var(--space-3)",
                          }}
                        >
                          FLAG
                        </span>
                      )}
                      {event.Category != "Flag" && event.Message && (
                        <span>
                        {createExtraMsgSpans(event.Message.trim(), DriverList)}
                        </span>
                      )}
                      {event.Category === "Flag" && event.Message && <span
                        style={{
                          backgroundColor: getFlagColour(event.Flag).bg,
                          color:
                            getFlagColour(event.Flag).fg ??
                            "var(--colour-fg)"
                        }}
                      >{createExtraMsgSpans(event.Message.trim(), DriverList)}</span>}
                      {event.TrackStatus && (
                        <span>TrackStatus: {event.TrackStatus}</span>
                      )}
                      {event.SessionStatus && (
                        <span>SessionStatus: {event.SessionStatus}</span>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <p>NO DATA YET</p>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: "3.5vw",
              display: "flex",
              width: "45%",
              flexDirection: "row",
              borderRight: "1px solid var(--colour-border)"
            }}
          >
            {!!TimingData && !!CarData ? (
              <>
                {(() => {
                  const lines = Object.entries(TimingData.Lines).sort(
                    sortPosition
                  );
                  return (
                    <>
                      <div
                        style={{
                          borderRight: "0.5vh solid var(--colour-border)",
                          width: "50%",
                          display: "flex", 
                          flexDirection: "column"
                        }}
                      >
                        {lines.slice(0, 10).map(([racingNumber, line]) => (
                          <Driver
                            key={`timing-data-${racingNumber}`}
                            racingNumber={racingNumber}
                            line={line}
                            DriverList={DriverList}
                            CarData={CarData}
                            TimingAppData={TimingAppData}
                            TimingStats={TimingStats}
                          />
                        ))}
                      </div>
                      <div
                        style={{
                          width: "50%",
                          display: "flex", 
                          flexDirection: "column"
                        }}
                      >
                        {lines
                          .slice(10, 20)
                          .map(([racingNumber, line], pos) => (
                            <Driver
                              key={`timing-data-${racingNumber}`}
                              racingNumber={racingNumber}
                              line={line}
                              DriverList={DriverList}
                              CarData={CarData}
                              TimingAppData={TimingAppData}
                              TimingStats={TimingStats}
                            />
                          ))}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p>NO DATA YET</p>
              </div>
            )}
          </div>
        </ResponsiveTable>
      </main>
    </>
  );
}
