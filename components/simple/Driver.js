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
    default:
      return "var(--colour-fg)";
  }
};

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
        flex: "1 1 0%"
      }}
    >
      <div
        style={{
          opacity: line.KnockedOut || line.Retired || line.Stopped ? 0.5 : 1,
          borderTop: line.IntervalToPositionAhead?.Catching ? "0.7vh dashed green" : "none",
          display: "flex",
          height: "100%",
          alignItems: "center"
        }}
      >
        <span>
          <span
            title="Driver"
            style={{
              color: driver?.TeamColour ? `#${driver.TeamColour}` : undefined,
              float: "left", 
              width: "30%", 
              textAlign: "left"
            }}
          >
            {driver?.Tla}
          </span>
        </span>
        <span title="Status" style={{float: "left", 
              width: "30%", 
              textAlign: "center"}}>
            {line.KnockedOut
              ? "OUT"
              : line.Retired
              ? "RET"
              : line.Stopped
              ? "STP"
              : line.InPit
              ? "PTI"
              : line.PitOut
              ? "PTO"
              : null}
        </span>
        
        <span style={{float: "left", 
              width: "40%", 
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
          {line.NumberOfPitStops ?? "—"}
        </span>
      </div>
    </DriverItem>
  );
};

export default Driver;
