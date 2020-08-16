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
import { createCalendarEvent } from "./calendar_utils";
import { pickDateInput } from "./booking-utils/booking-utils";

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
