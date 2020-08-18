import { getCalendarEvents } from "../calendar_utils";
import { handleEventsForRequestedTimePeriod } from "./handle-events-for-requested-time-period";

export function timePeriodOnlyHandler(agent) {
  const timePeriod = agent.parameters["time-period"];
  console.log("IN TIME PERIOD");
  console.log(timePeriod);
  const startTime = new Date(timePeriod.startTime);
  const endTime = new Date(timePeriod.endTime);
  const maxSearchDate = new Date(
    new Date(startTime).setMonth(startTime.getMonth() + 1)
  );

  return getCalendarEvents(startTime, maxSearchDate).then(
    (events) =>
      handleEventsForRequestedTimePeriod(events, startTime, endTime, agent),
    (rejectReason) => {
      console.log("HAAAAAARE");
      console.log(rejectReason);
      if (rejectReason.message === "No Events Available") {
        handleEventsForRequestedTimePeriod([], startTime, endTime, agent);
      } else {
        agent.add("sorry, broked");
      }
    }
  );
}
