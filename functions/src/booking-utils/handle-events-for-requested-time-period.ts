import { dateOptions, timeOptions } from "../date_time_options";

const { Payload } = require("dialogflow-fulfillment");

export function handleEventsForRequestedTimePeriod(
  events,
  startTime,
  endTime,
  agent
) {
  // put all events in a datemap.
  // add available date in new array. cancel if eventStart between time period (time)

  const reducer = (accumulator, currentValue) => {
    const eventDateKey = new Date(currentValue.start.dateTime).getDate();
    const eventStartTime = new Date(currentValue.start.dateTime);

    //              2:00 - 8:00                 2:00 - 8:00
    //              -----------                 -----------
    //              5:00 - 6:00                 2:00 - 3:00
    //              1:30 - 2:30                 3:30 - 4:30
    //              7:30 - 8:30                 7:00 - 8:00

    //              120     480                 120     480
    //              -----------                 -----------
    //              300     360                 300     360
    //              90      150                 90      150
    //              450     510                 450     510

    const eventStartTimeInMinutes =
      eventStartTime.getHours() * 60 + eventStartTime.getMinutes();
    const eventDurationInMinutes = 60;

    const requestedStartTimeInMinutes =
      startTime.getHours() * 60 + startTime.getMinutes();
    const requestedEndTimeInMinutes =
      endTime.getHours() * 60 + endTime.getMinutes();
    console.log(currentValue);
    console.log("eventStartTimeInMinutes: " + eventStartTimeInMinutes);
    console.log("requestedStartTimeInMinutes: " + requestedStartTimeInMinutes);
    console.log("requestedEndTimeInMinutes: " + requestedEndTimeInMinutes);

    if (
      eventStartTimeInMinutes + eventDurationInMinutes <=
        requestedStartTimeInMinutes ||
      eventStartTimeInMinutes >= requestedEndTimeInMinutes
    ) {
      return accumulator;
    }
    const dayEvents = accumulator[eventDateKey];
    if (dayEvents) {
      dayEvents.push(currentValue);
    } else {
      const newDayEvents = [currentValue];
      accumulator[eventDateKey] = newDayEvents;
    }
    return accumulator;
  };

  const unavailableDays = events.reduce(reducer, {});
  console.log("UNAVAILABLE DAYS: ");
  console.log(JSON.stringify(unavailableDays));

  const availableDateTimeSlots = [];
  const startDate = new Date();
  for (let i = 0; i < 28; i++) {
    if (availableDateTimeSlots.length === 10) {
      break;
    }
    const availableDate = new Date(
      new Date(startDate).setDate(startDate.getDate() + i)
    );
    if (!unavailableDays[availableDate.getDate()]) {
      // date is FULLY available
      // push all timeslots starting from requested time range
      // console.log(availableDate);
      for (let i = startTime.getHours(); i < endTime.getHours(); i++) {
        const availableDateTimeSlot = new Date(availableDate);
        availableDateTimeSlot.setHours(i);
        availableDateTimeSlot.setMinutes(0);
        availableDateTimeSlots.push(availableDateTimeSlot);
      }
    } else {
      const fuckyDate = unavailableDays[availableDate.getDate()];
    }
  }

  const googleItems = [];
  const facebookItems = [];
  availableDateTimeSlots.forEach((day, index) => {
    const dayString = day.toLocaleDateString("en-us", dateOptions);
    const timeString = day.toLocaleTimeString("en-us", timeOptions);
    if (index < 30) {
      googleItems.push({
        optionInfo: {
          key: day.toISOString(),
        },
        title: `${dayString} at ${timeString}`,
      });
    }

    if (index < 10) {
      facebookItems.push({
        title: dayString,
        buttons: [
          {
            title: `Select ${timeString}`,
            type: "postback",
            payload: `Select ${dayString} at ${timeString}`,
          },
        ],
      });
    }
  });

  const facebookPayload = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: facebookItems,
      },
    },
  };

  agent.add(new Payload(agent.FACEBOOK, facebookPayload));

  agent.add(
    new Payload(agent.ACTIONS_ON_GOOGLE, {
      expectUserResponse: true,
      systemIntent: {
        intent: "actions.intent.OPTION",
        data: {
          "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
          listSelect: {
            title: `Available slots for your requested time range:`,
            items: googleItems,
          },
        },
      },
      richResponse: {
        items: [
          {
            simpleResponse: {
              textToSpeech: "Sure. Which one of these slots works for you?",
            },
          },
        ],
      },
    })
  );
}
