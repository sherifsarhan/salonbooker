"use strict";
const http = require("http");
const functions = require("firebase-functions");
const { WebhookClient, Payload } = require("dialogflow-fulfillment");
const httpAgent = new http.Agent({ keepAlive: true });

import { SERVICES_OFFERED_GOOGLE_PAYLOAD } from "./google/services_offered";
import { STYLISTS_GOOGLE_PAYLOAD } from "./google/stylists";
import { SELECTION_MAP_GOOGLE } from "./google/selection_map";

import { SERVICES_OFFERED_FACEBOOK_PAYLOAD } from "./facebook/services_offered";
import { STYLISTS_FACEBOOK_PAYLOAD } from "./facebook/stylists";
import { SELECTION_MAP_FACEBOOK } from "./facebook/selection_map";

import { dateOptions, timeOptions } from "./date_time_options";
import {
  getAvailableDays,
  getCalendarEvents,
  createCalendarEvent,
} from "./calendar_utils";

process.env.DEBUG = "dialogflow:*"; // It enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
  (request, response) => {
    request.agent = httpAgent;
    const agent = new WebhookClient({
      request,
      response,
    });

    // console.log("Dialogflow Request Headers: " + JSON.stringify(request.headers));
    // console.log("Dialogflow Request BODY: " + JSON.stringify(request.body));

    function makeAppointment(agent) {
      console.log("FUNCTION makeAppointment");
      console.log(agent.parameters);
      agent.context.set({
        name: "appointment",
        lifespan: 5,
        parameters: {
          phoneNumber: agent.parameters.PhoneNumber,
        },
      });

      agent.add(
        new Payload(agent.ACTIONS_ON_GOOGLE, SERVICES_OFFERED_GOOGLE_PAYLOAD)
      );

      agent.add(new Payload(agent.FACEBOOK, SERVICES_OFFERED_FACEBOOK_PAYLOAD));
    }

    function selectStylist(agent) {
      agent.add(new Payload(agent.ACTIONS_ON_GOOGLE, STYLISTS_GOOGLE_PAYLOAD));

      agent.add(new Payload(agent.FACEBOOK, STYLISTS_FACEBOOK_PAYLOAD));
    }

    function makeAppointmentGoogleFollowup(agent) {
      const actionsContext = getOutputContext("actions_intent_option");
      console.log("FUNCTION makeAppointmentGoogleFollowup");

      const appointmentType =
        SELECTION_MAP_GOOGLE[actionsContext.parameters.OPTION];

      agent.context.set({
        name: "appointment",
        lifespan: 5,
        parameters: {
          appointmentType: appointmentType,
        },
      });

      agent.add(`Sure! ${appointmentType}!`);
      agent.setFollowupEvent("PICK_DATE");
    }

    function makeAppointmentGoogleFollowupDifferentDateYes(agent) {
      console.log("FUNCTION makeAppointmentGoogleFollowupDifferentDateYes");
      agent.add("Okay!");
      agent.setFollowupEvent("PICK_DATE");
    }

    function makeAppointmentFacebookFollowup(agent) {
      console.log("FUNCTION makeAppointmentFacebookFollowup");
      const genericContext = getOutputContext("generic");
      const appointmentType =
        SELECTION_MAP_FACEBOOK[genericContext.parameters.appointmentType];

      agent.context.set({
        name: "appointment",
        lifespan: 5,
        parameters: {
          appointmentType: appointmentType,
        },
      });
      agent.add(`Sure! ${appointmentType}!`);
      agent.setFollowupEvent("PICK_DATE");
    }

    function makeAppointmentFacebookFollowupDifferentDateYes(agent) {
      console.log("FUNCTION makeAppointmentFacebookFollowupDifferentDateYes");
      agent.add("Okay!");
      agent.setFollowupEvent("PICK_DATE");
    }

    function getOutputContext(contextName) {
      const requestContexts = request.body.queryResult.outputContexts;
      for (const currContext of requestContexts) {
        const context = currContext;
        const name = context.name.split("/").slice(-1)[0];

        if (name === contextName) {
          return {
            name,
            lifespanCount: context.lifespanCount,
            parameters: context.parameters,
          };
        }
      }
      return null;
    }

    function pickDateInput(agent) {
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
        const requestedDate = new Date(
          new Date(agent.parameters.date).setHours(0)
        );
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
              dateOnlyShowAvailableTimes(
                requestedDate,
                availableTimeSlots,
                agent
              );
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
            handleEventsForRequestedTimePeriod(
              events,
              startTime,
              endTime,
              agent
            ),
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
          (events) =>
            handleEventsForRequestedTime(events, dateTimeStart, agent),
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

    function dateOnlyShowAvailableTimes(
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

    function handleEventsForRequestedTime(events, dateTimeStart, agent) {
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

    function handleEventsForRequestedTimePeriod(
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
        console.log(
          "requestedStartTimeInMinutes: " + requestedStartTimeInMinutes
        );
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

    function pickDateInputConfirmGoogle(agent) {
      console.log("FUNCTION pickDateInputConfirmGoogle");
      const actionsContext = getOutputContext("actions_intent_option");
      console.log(actionsContext);
      const selectedDate = new Date(actionsContext.parameters.OPTION);
      const appointmentContext = agent.context.get("appointment");
      const appointmentType = appointmentContext.parameters.appointmentType;

      const dateTimeStart = selectedDate;
      const dateTimeEnd = new Date(selectedDate);
      dateTimeEnd.setHours(dateTimeStart.getHours() + 1);

      return createCalendarEvent(
        dateTimeStart,
        dateTimeEnd,
        appointmentType,
        appointmentContext.parameters.phoneNumber
      ).then((success) => {
        agent.end(
          `Great! We're looking forward to seeing you on ${dateTimeStart.toLocaleDateString(
            "en-us",
            dateOptions
          )} at ${dateTimeStart.toLocaleTimeString(
            "en-us",
            timeOptions
          )} for your selected package: ${appointmentType}`
        );
        agent.context.set({
          name: "appointment",
          parameters: null,
        });
        console.log("SUCCESSFULLY BOOKED APPOINTMENT");
        return success;
      });
    }

    function pickDateInputConfirmFacebook(agent) {
      const appointmentContext = agent.context.get("appointment");
      console.log("FUNCTION pickDateInputConfirmFacebook");
      console.log(appointmentContext);
      console.log(agent.parameters.date);
      console.log(agent.parameters.time);
      console.log(appointmentContext.parameters.requestedTime);
      const selectedDate = new Date(agent.parameters.date);
      const selectedHours =
        new Date(agent.parameters.time).getHours() ||
        appointmentContext.parameters.requestedHours;
      let selectedMinutes = new Date(agent.parameters.time).getMinutes();
      if (typeof selectedMinutes !== "number") {
        selectedMinutes = appointmentContext.parameters.requestedMinutes;
      }
      console.log(selectedHours);
      console.log(selectedMinutes);
      selectedDate.setHours(selectedHours);
      selectedDate.setMinutes(selectedMinutes);
      console.log(selectedDate);
      const appointmentType = appointmentContext.parameters.appointmentType;

      const dateTimeStart = selectedDate;
      const dateTimeEnd = new Date(selectedDate);
      dateTimeEnd.setHours(dateTimeStart.getHours() + 1);

      return createCalendarEvent(
        dateTimeStart,
        dateTimeEnd,
        appointmentType,
        appointmentContext.parameters.phoneNumber
      ).then((success) => {
        agent.end(
          `Great! We're looking forward to seeing you on ${dateTimeStart.toLocaleDateString(
            "en-us",
            dateOptions
          )} at ${dateTimeStart.toLocaleTimeString(
            "en-us",
            timeOptions
          )} for your selected package: ${appointmentType}`
        );
        agent.context.set({
          name: "appointment",
          parameters: null,
        });
        console.log("SUCCESSFULLY BOOKED APPOINTMENT");
        return success;
      });
    }

    function pickDateInputRetryYes(agent) {
      agent.add("Okay!");
      agent.setFollowupEvent("PICK_DATE");
    }

    const intentMap = new Map();
    intentMap.set("Make Appointment", makeAppointment);

    intentMap.set("Make Appointment - Select Stylist", selectStylist);

    intentMap.set(
      "Make Appointment - Google Followup",
      makeAppointmentGoogleFollowup
    );
    intentMap.set(
      "Make Appointment - Google Followup - Different Date - yes",
      makeAppointmentGoogleFollowupDifferentDateYes
    );

    intentMap.set(
      "Make Appointment - Facebook Followup",
      makeAppointmentFacebookFollowup
    );
    intentMap.set(
      "Make Appointment - Facebook Followup - Different Date - yes",
      makeAppointmentFacebookFollowupDifferentDateYes
    );

    intentMap.set("Pick Date - Input", pickDateInput);
    intentMap.set(
      "Pick Date - Input - Confirm - Google",
      pickDateInputConfirmGoogle
    );
    intentMap.set(
      "Pick Date - Input - Confirm - Facebook",
      pickDateInputConfirmFacebook
    );

    intentMap.set("Pick Date - Input - RetryYes", pickDateInputRetryYes);

    agent.handleRequest(intentMap);
  }
);
