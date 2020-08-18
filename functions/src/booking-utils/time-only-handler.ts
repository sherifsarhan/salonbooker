import { getCalendarEvents } from "../calendar_utils";
import { handleEventsForRequestedTime } from "./handle-events-for-requested-time";

export function timeOnlyHandler(agent) {
  let dateTimeStart, dateTimeEnd;
  dateTimeStart = new Date(agent.parameters.time);
  agent.context.set({
    name: "appointment",
    lifespan: 2,
    parameters: {
      requestedHours: dateTimeStart.getHours(),
      requestedMinutes: dateTimeStart.getMinutes(),
    },
  });
  dateTimeEnd = new Date(
    new Date(dateTimeStart).setMonth(dateTimeStart.getMonth() + 1)
  );

  return getCalendarEvents(dateTimeStart, dateTimeEnd).then(
    (events) => handleEventsForRequestedTime(events, dateTimeStart, agent),
    (rejectReason) => {
      console.log(rejectReason.message);
      if (rejectReason.message === "No Events Available") {
        handleEventsForRequestedTime([], dateTimeStart, agent);
      } else {
        agent.add("sorry, broked");
      }
    }
  );
}
