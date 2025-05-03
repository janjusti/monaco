import { useState, useEffect } from "react";
import styled from "styled-components";
import { transparentize } from "polished";

const drsEnabledValues = [10, 12, 14];

const getSegmentColour = (status) => {
  switch (status) {
    case 2048:
      return "yellow";
    case 2049:
      return "limegreen";
    case 2051:
      return "magenta";
    case 2064:
      return "blue";
    default:
      return "var(--colour-offset)";
  }
};

const getTyreColour = (compound) => {
  switch (compound?.toLowerCase()) {
    case "soft":
      return "red";
    case "medium":
      return "yellow";
    case "hard":
      return "var(--colour-fg)";
    case "intermediate":
      return "green";
    case "wet":
      return "blue";
    case "unknown":
      return "grey";
    default:
      return "var(--colour-fg)";
  }
};

const generateChequeredFlag = (opacity, size) => {
  return `repeating-linear-gradient(
    90deg,
    rgba(0, 0, 0, ${opacity}) 0,
    rgba(0, 0, 0, ${opacity}) ${size}vh,
    rgba(255, 255, 255, ${opacity}) ${size}vh,
    rgba(255, 255, 255, ${opacity}) ${size*2}vh
  ), repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, ${opacity}) 0,
    rgba(0, 0, 0, ${opacity}) ${size}vh,
    rgba(255, 255, 255, ${opacity}) ${size}vh,
    rgba(255, 255, 255, ${opacity}) ${size*2}vh
  )`
}

const generateCatchingLine = (line) => {
  const fontSize = "0.35vh";
  const colour = "limegreen";
  if (line.IntervalToPositionAhead && typeof line.IntervalToPositionAhead.Value === 'string') {
    let match = line.IntervalToPositionAhead.Value.match(/^\+(\d+\.\d+)$/);
    if (match) {
      let number = parseFloat(match[1]);
      if (number < 1 && !line.InPit && !line.PitOut) {
        return `${fontSize} solid ${colour}`;
      }
    }
  }
  return line.IntervalToPositionAhead?.Catching ? `${fontSize} dashed ${colour}` : "none";
}

const isDriverOut = (line) => {
  return line.KnockedOut || line.Retired || line.Stopped
}

const gridCols = "21px 52px 64px 64px 21px 90px 90px 52px 45px auto";
const gridColsSmall = "18px 42px 60px 60px 18px 74px 74px 44px 38px auto";

const DriverItem = styled.div`
  border-bottom: 1px solid var(--colour-border);
  background-color: ${({ posChanged }) =>
    posChanged ? transparentize(0.6, posChanged) : "transparent"};
  transition: background-color 300ms;

  > div {
    padding: 0 var(--space-3);
    display: flex;
    grid-gap: var(--space-3);
    justify-content: space-between; width: 100%;
  }
`;

const ProgressBar = styled.span`
  display: block;
  width: 100%;
  height: 4px;
  background-color: var(--colour-border);
  margin: var(--space-2) 0;
  > span {
    display: block;
    height: 4px;
    transition: width 100ms linear;
    pointer-events: none;
  }
`;

const StyledTableHeader = styled.div`
  padding: var(--space-2) var(--space-3);
  background-color: var(--colour-offset);
  border-top: 1px solid var(--colour-border);
  display: grid;
  grid-template-columns: ${gridColsSmall};
  grid-gap: var(--space-3);

  @media screen and (min-width: 900px) {
    grid-template-columns: ${gridCols};
    grid-gap: var(--space-4);
  }
`;

export const TableHeader = () => (
  <StyledTableHeader>
    <p>POS</p>
    <p style={{ textAlign: "right" }}>DRIVER</p>
    <p>TYRE</p>
  </StyledTableHeader>
);

const getPosChangeColour = (pos, gridPos) => {
  if (pos < gridPos) return "limegreen";
  if (pos > gridPos) return "red";
  return "grey";
};

const Driver = ({
  racingNumber,
  line,
  DriverList,
  CarData,
  TimingAppData,
  TimingStats,
  position,
  sessionInfo
}) => {
  const driver = DriverList[racingNumber];
  const carData =
    CarData.Entries[CarData.Entries.length - 1].Cars[racingNumber].Channels;

  const rpmPercent = (carData["0"] / 15000) * 100;
  const throttlePercent = Math.min(100, carData["4"]);
  const brakeApplied = carData["5"] > 0;

  const appData = TimingAppData?.Lines[racingNumber];
  let currentStint;
  if (appData?.Stints) {
    const stints = Object.values(appData.Stints);
    currentStint = stints[stints.length - 1];
  }

  const lineStats = Object.values(line.Stats ?? {});

  const [posChanged, setPosChanged] = useState();
  const [prevPos, setPrevPos] = useState();
  useEffect(() => {
    const pos = Number(line.Position);
    if (prevPos !== undefined && pos !== prevPos) {
      setPosChanged(getPosChangeColour(pos, prevPos));
      setTimeout(() => {
        setPosChanged(undefined);
      }, 5000);
    }

    setPrevPos(pos);
  }, [line.Position]);

  return (
    <DriverItem
      teamColour={driver?.TeamColour ? `#${driver.TeamColour}` : undefined}
      posChanged={posChanged}
      style={{
        flex: "1 1 0%",
        borderTop: position === 5 ? "0.5vh solid var(--colour-border)" : undefined
      }}
    >
      <div
        style={{
          opacity: isDriverOut(line) ? 0.5 : 1,
          borderTop: generateCatchingLine(line),
          background: [1104, 1088].includes(line.Status)
          ? generateChequeredFlag(0.1, 2)
          : (!line.BestLapTime?.Value && sessionInfo.Type?.toLowerCase().includes("qualify"))
            ? "rgba(128, 128, 128, 0.3)"
            : "transparent",
          display: "flex",
          height: "100%",
          alignItems: "center"
        }}
      >
        <span
          title="Driver"
          style={{
            color: driver?.TeamColour ? `#${driver.TeamColour}` : undefined,
            background: carData["2"] < 40 && !line.InPit && !line.PitOut ? "rgba(255, 0, 0, 0.3)" : "transparent",
            float: "left", 
            width: "50%",
            textAlign: "left",
            textDecoration: /^\d+\s*L$/.test(line.GapToLeader) ? 'underline' : ''
          }}
        >
          {driver?.Tla}
        </span>     
        <span style={{float: "left", 
              width: "50%",
              textAlign: "right"}}>
          <span title="Tyre">
            <span style={{ 
              color: getTyreColour(currentStint?.Compound), 
              textDecoration: currentStint?.New === "false" ? 'underline' : ""
            }}>
              {currentStint?.TotalLaps == undefined ? "—" : currentStint?.TotalLaps}
            </span>
          </span>
          {"|"}
          <span title="Pit stops" style={{
            background: isDriverOut(line) ? "transparent" : line.InPit ? "red" : line.PitOut ? "green" : "transparent"
          }}>
            {line.NumberOfPitStops ?? "—"}
          </span>
        </span>
      </div>
    </DriverItem>
  );
};

export default Driver;
