import { createCalendarEvent, getCalendarEvents } from "../calendar_utils";
import { dateOptions, timeOptions } from "../date_time_options";
import { dateOnlyShowAvailableTimes } from "./date-only-show-available-times";
import { handleEventsForRequestedTimePeriod } from "./handle-events-for-requested-time-period";
import { handleEventsForRequestedTime } from "./handle-events-for-requested-time";

export function pickDateInput(agent) {
  console.log("FUNCTION pickDateInput");

  console.log("parameters");
  console.log(agent.parameters);
  const appointmentContext = agent.context.get("appointment");
  console.log("appointment context:");
  console.log(appointmentContext);

  let date, time, combinedDateTimeString, dateTimeStart, dateTimeEnd;
  const appointmentType = appointmentContext.parameters.appointmentType;
  agent.context.set({
    name: "appointment",
    lifespan: 5,
    parameters: {
      appointmentType: appointmentType,
    },
  });
  // if date && time, attempt to book
  if (agent.parameters.date && agent.parameters.time) {
    date = agent.parameters.date.split("T")[0];
    time = agent.parameters.time.split("T")[1];
    combinedDateTimeString = date + "T" + time;
    dateTimeStart = new Date(combinedDateTimeString);
    dateTimeEnd = new Date(
      new Date(dateTimeStart).setHours(dateTimeStart.getHours() + 1)
    );

    return createCalendarEvent(
      dateTimeStart,
      dateTimeEnd,
      appointmentType,
      appointmentContext.parameters.phoneNumber
    ).then(
      (success) => {
        agent.end(
          `Great! We're looking forward to seeing you on ${dateTimeStart.toLocaleDateString(
            "en-us",
            dateOptions
          )} at ${dateTimeStart.toLocaleTimeString(
            "en-us",
            timeOptions
          )} for your selected package: ${appointmentType}`
        );
        console.log("done");
        console.log(success);
        return success;
      },
      (rejectReason) => {
        //handle rejection
        console.log(rejectReason);
        agent.add(
          `Sorry, we'll be booked then.  Would you like to select a different date?`
        );
      }
    );
  }
  // if date && time-period, show up to 5 available appointments
  // if date-period && time, show up to 5 available appointments
  // if date-period && time-period, show up to 5 available appointments

  // if ONLY date, show up to 5 available appointments
  if (agent.parameters.date) {
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
  // if ONLY date-period, show next 5 available appointments
  // if ONLY time period, show next 5 available appointments
  if (agent.parameters["time-period"]) {
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
  // if ONLY time, find next 5 available appointments
  if (agent.parameters.time) {
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
  } else {
    console.log(agent.parameters);
    // agent.add("Okay!");
  }
  return null;
}
