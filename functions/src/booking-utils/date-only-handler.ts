import { getCalendarEvents } from "../calendar_utils";
import { dateOnlyShowAvailableTimes } from "./date-only-show-available-times";

export function dateOnlyHandler(agent) {
  const requestedDate = new Date(new Date(agent.parameters.date).setHours(0));
  const maxSearchDate = new Date(new Date(requestedDate).setHours(24));
  return getCalendarEvents(requestedDate, maxSearchDate).then(
    (events: any) => {
      const unavailableTimes = {};
      events.forEach((event) => {
        const currEvent = new Date(event.start.dateTime);
        unavailableTimes[currEvent.getHours()] = true;
      });
      console.log(unavailableTimes);
      const availableTimeSlots = [];
      for (let i = 13; i < 22; i++) {
        if (!unavailableTimes[i]) {
          const availableTimeSlot = new Date(
            new Date(requestedDate).setHours(i)
          );
          availableTimeSlots.push(availableTimeSlot);
        }
      }
      return dateOnlyShowAvailableTimes(
        requestedDate,
        availableTimeSlots,
        agent
      );
    },
    (rejectReason) => {
      console.log(rejectReason.message);
      if (rejectReason.message === "No Events Available") {
        // all events 9-5 are available.
        const availableTimeSlots = [];
        for (let i = 13; i < 22; i++) {
          const availableTimeSlot = new Date(
            new Date(requestedDate).setHours(i)
          );
          availableTimeSlots.push(availableTimeSlot);
        }
        dateOnlyShowAvailableTimes(requestedDate, availableTimeSlots, agent);
      } else {
        agent.add("sorry, broked");
      }
    }
  );
}
