"use strict";
const http = require("http");
const functions = require("firebase-functions");
const { google } = require("googleapis");
const { WebhookClient, Payload } = require("dialogflow-fulfillment");
const httpAgent = new http.Agent({ keepAlive: true });
import SERVICES_OFFERED_GOOGLE_PAYLOAD from "./google/services_offered";
import STYLISTS_GOOGLE_PAYLOAD from "./google/stylists";
import SELECTION_MAP_GOOGLE from "./google/selection_map";

import SERVICES_OFFERED_FACEBOOK_PAYLOAD from "./facebook/services_offered";
import STYLISTS_FACEBOOK_PAYLOAD from "./facebook/stylists";
import SELECTION_MAP_FACEBOOK from "./facebook/selection_map";

import { dateOptions, timeOptions } from "./date_time_options";

import { calendarId, serviceAccount } from "./auth_settings";

// Set up Google Calendar Service account credentials
const serviceAccountAuth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: "https://www.googleapis.com/auth/calendar",
});

const calendar = google.calendar("v3");

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
      let actionsContext = getOutputContext("actions_intent_option");
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
      let genericContext = getOutputContext("generic");
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
      for (let index = 0; index < requestContexts.length; index++) {
        const context = requestContexts[index];
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
        let requestedDate = new Date(
          new Date(agent.parameters.date).setHours(0)
        );
        let maxSearchDate = new Date(new Date(requestedDate).setHours(24));
        return getCalendarEvents(requestedDate, maxSearchDate).then(
          (events) => {
            let unavailableTimes = {};
            events.forEach((event) => {
              let currEvent = new Date(event.start.dateTime);
              unavailableTimes[currEvent.getHours()] = true;
            });
            console.log(unavailableTimes);
            let availableTimeSlots = [];
            for (let i = 13; i < 22; i++) {
              if (!unavailableTimes[i]) {
                let availableTimeSlot = new Date(
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
              let availableTimeSlots = [];
              for (let i = 13; i < 22; i++) {
                let availableTimeSlot = new Date(
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
        let startTime = new Date(timePeriod.startTime);
        let endTime = new Date(timePeriod.endTime);
        let maxSearchDate = new Date(
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
      let googleItems = [];
      let facebookItems = [];
      availableTimeSlots.forEach((day, index) => {
        let timeString = day.toLocaleTimeString("en-us", timeOptions);
        let dayString = day.toLocaleDateString("en-us", dateOptions);
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
        let eventDateKey = new Date(currentValue.start.dateTime).getDate();
        let eventStartTime = new Date(currentValue.start.dateTime);

        if (
          Math.abs(
            dateTimeStart.getHours() * 60 +
              dateTimeStart.getMinutes() -
              (eventStartTime.getHours() * 60 + eventStartTime.getMinutes())
          ) >= 60
        ) {
          return accumulator;
        }
        let dayEvents = accumulator[eventDateKey];
        if (dayEvents) {
          dayEvents.push(currentValue);
        } else {
          let newDayEvents = [currentValue];
          accumulator[eventDateKey] = newDayEvents;
        }
        return accumulator;
      };

      let unavailableDays = events.reduce(reducer, {});
      console.log("UNAVAILABLE DAYS: ");
      console.log(JSON.stringify(unavailableDays));

      let availableDays = [];
      for (let i = 0; i < 28; i++) {
        let availableDate = new Date(
          new Date(dateTimeStart).setDate(dateTimeStart.getDate() + i)
        );
        if (!unavailableDays[availableDate.getDate()]) {
          //date is available
          // console.log(availableDate);
          availableDays.push(availableDate);
        }
      }

      let googleItems = [];
      let facebookItems = [];
      availableDays.forEach((day, index) => {
        let dayString = day.toLocaleDateString("en-us", dateOptions);
        let timeString = day.toLocaleTimeString("en-us", timeOptions);

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
        let eventDateKey = new Date(currentValue.start.dateTime).getDate();
        let eventStartTime = new Date(currentValue.start.dateTime);

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

        let eventStartTimeInMinutes =
          eventStartTime.getHours() * 60 + eventStartTime.getMinutes();
        let eventDurationInMinutes = 60;

        let requestedStartTimeInMinutes =
          startTime.getHours() * 60 + startTime.getMinutes();
        let requestedEndTimeInMinutes =
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
        let dayEvents = accumulator[eventDateKey];
        if (dayEvents) {
          dayEvents.push(currentValue);
        } else {
          let newDayEvents = [currentValue];
          accumulator[eventDateKey] = newDayEvents;
        }
        return accumulator;
      };

      let unavailableDays = events.reduce(reducer, {});
      console.log("UNAVAILABLE DAYS: ");
      console.log(JSON.stringify(unavailableDays));

      let availableDateTimeSlots = [];
      let startDate = new Date();
      for (let i = 0; i < 28; i++) {
        if (availableDateTimeSlots.length === 10) {
          break;
        }
        let availableDate = new Date(
          new Date(startDate).setDate(startDate.getDate() + i)
        );
        if (!unavailableDays[availableDate.getDate()]) {
          // date is FULLY available
          // push all timeslots starting from requested time range
          // console.log(availableDate);
          for (let i = startTime.getHours(); i < endTime.getHours(); i++) {
            let availableDateTimeSlot = new Date(availableDate);
            availableDateTimeSlot.setHours(i);
            availableDateTimeSlot.setMinutes(0);
            availableDateTimeSlots.push(availableDateTimeSlot);
          }
        } else {
          let fuckyDate = unavailableDays[availableDate.getDate()];
        }
      }

      let googleItems = [];
      let facebookItems = [];
      availableDateTimeSlots.forEach((day, index) => {
        let dayString = day.toLocaleDateString("en-us", dateOptions);
        let timeString = day.toLocaleTimeString("en-us", timeOptions);
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
      let actionsContext = getOutputContext("actions_intent_option");
      console.log(actionsContext);
      let selectedDate = new Date(actionsContext.parameters.OPTION);
      const appointmentContext = agent.context.get("appointment");
      const appointmentType = appointmentContext.parameters.appointmentType;

      const dateTimeStart = selectedDate;
      let dateTimeEnd = new Date(selectedDate);
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
      let selectedDate = new Date(agent.parameters.date);
      let selectedHours =
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
      let dateTimeEnd = new Date(selectedDate);
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

    let intentMap = new Map();
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

function getAvailableDays(dateTimeStart, dateTimeEnd) {
  return new Promise((resolve, reject) => {
    calendar.freebusy.query(
      {
        auth: serviceAccountAuth,
        headers: {
          "content-type": "application/json",
        },
        resource: {
          timeMin: dateTimeStart.toISOString(),
          timeMax: dateTimeEnd.toISOString(),
          items: [
            {
              id: calendarId,
            },
          ],
        },
      },
      (err, calendarResponse) => {
        console.log("here");
        console.log(calendarResponse.data);
        if (err) {
          reject(err);
        } else {
          resolve(calendarResponse.data);
        }
      }
    );
  });
}

function getCalendarEvents(dateTimeStart, dateTimeEnd) {
  return new Promise((resolve, reject) => {
    calendar.events.list(
      {
        auth: serviceAccountAuth, // List events for time period
        calendarId: calendarId,
        timeMin: dateTimeStart.toISOString(),
        timeMax: dateTimeEnd.toISOString(),
      },
      (err, calendarResponse) => {
        if (calendarResponse.data.items.length > 0) {
          resolve(calendarResponse.data.items);
        } else {
          console.log("no events available");
          reject(err || new Error("No Events Available"));
        }
      }
    );
  });
}

function createCalendarEvent(
  dateTimeStart,
  dateTimeEnd,
  appointmentType,
  phoneNumber
) {
  return new Promise((resolve, reject) => {
    calendar.events.list(
      {
        auth: serviceAccountAuth, // List events for time period
        calendarId: calendarId,
        timeMin: dateTimeStart.toISOString(),
        timeMax: dateTimeEnd.toISOString(),
      },
      (err, calendarResponse) => {
        console.log("IN CALENDAR EVENT LIST CALL BACK");
        // Check if there is a event already on the Bike Shop Calendar
        let conflict = false;
        if (err || calendarResponse.data.items.length > 0) {
          if (err) {
            conflict = true;
            reject(err);
            return;
          }
          if (calendarResponse.data.items.length) {
            calendarResponse.data.items.forEach((item) => {
              console.log("APPOINTMENT TYPE: " + appointmentType);
              if (item.summary === appointmentType) {
                conflict = true;
                reject(
                  new Error("Requested time conflicts with another appointment")
                );
                return;
              }
            });
          }
        }
        if (!conflict) {
          console.log("why");
          // Create event for the requested time period
          calendar.events.insert(
            {
              auth: serviceAccountAuth,
              calendarId: calendarId,
              resource: {
                summary: appointmentType,
                description: phoneNumber,
                start: {
                  dateTime: dateTimeStart,
                },
                end: {
                  dateTime: dateTimeEnd,
                },
              },
            },
            (err, event) => {
              return err ? reject(err) : resolve(event);
            }
          );
        }
      }
    );
  });
}
