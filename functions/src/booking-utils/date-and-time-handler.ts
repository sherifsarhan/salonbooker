import { createCalendarEvent } from "../calendar_utils";
import { dateOptions, timeOptions } from "../date_time_options";

export function dateAndTimeHandler(agent, appointmentType, appointmentContext) {
  let date, time, combinedDateTimeString, dateTimeStart, dateTimeEnd;

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
