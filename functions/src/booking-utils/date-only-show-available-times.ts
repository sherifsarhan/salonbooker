import { timeOptions, dateOptions } from "../date_time_options";
const { Payload } = require("dialogflow-fulfillment");

export function dateOnlyShowAvailableTimes(
  requestedDate,
  availableTimeSlots,
  agent
) {
  const googleItems = [];
  const facebookItems = [];
  availableTimeSlots.forEach((day, index) => {
    const timeString = day.toLocaleTimeString("en-us", timeOptions);
    const dayString = day.toLocaleDateString("en-us", dateOptions);
    if (index < 30) {
      googleItems.push({
        optionInfo: {
          key: day.toISOString(),
        },
        title: `${timeString}`,
      });
    }

    if (index < 10) {
      facebookItems.push({
        title: timeString,
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
            title: `Available times for ${requestedDate.toLocaleDateString(
              "en-us",
              dateOptions
            )}`,
            items: googleItems,
          },
        },
      },
      richResponse: {
        items: [
          {
            simpleResponse: {
              textToSpeech: "Sure. Which one of these times works for you?",
            },
          },
        ],
      },
    })
  );
}
