import { dateOptions, timeOptions } from "../date_time_options";
const { Payload } = require("dialogflow-fulfillment");

export function handleEventsForRequestedTime(events, dateTimeStart, agent) {
  // put all events in a datemap.
  // add available date in new array. cancel if eventStart at 4pm (time)

  const reducer = (accumulator, currentValue) => {
    const eventDateKey = new Date(currentValue.start.dateTime).getDate();
    const eventStartTime = new Date(currentValue.start.dateTime);

    if (
      Math.abs(
        dateTimeStart.getHours() * 60 +
          dateTimeStart.getMinutes() -
          (eventStartTime.getHours() * 60 + eventStartTime.getMinutes())
      ) >= 60
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

  const availableDays = [];
  for (let i = 0; i < 28; i++) {
    const availableDate = new Date(
      new Date(dateTimeStart).setDate(dateTimeStart.getDate() + i)
    );
    if (!unavailableDays[availableDate.getDate()]) {
      //date is available
      // console.log(availableDate);
      availableDays.push(availableDate);
    }
  }

  const googleItems = [];
  const facebookItems = [];
  availableDays.forEach((day, index) => {
    const dayString = day.toLocaleDateString("en-us", dateOptions);
    const timeString = day.toLocaleTimeString("en-us", timeOptions);

    googleItems.push({
      optionInfo: {
        key: day.toISOString(),
      },
      title: dayString,
    });
    if (index < 10) {
      facebookItems.push({
        title: dayString,
        buttons: [
          {
            title: `Select ${dayString}`,
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
            title: `Available Days for ${dateTimeStart.toLocaleTimeString(
              "en-us",
              timeOptions
            )}`,
            items: googleItems,
          },
        },
      },
      richResponse: {
        items: [
          {
            simpleResponse: {
              textToSpeech: "Sure. Which one of these days works for you?",
            },
          },
        ],
      },
    })
  );
}
