const { google } = require("googleapis");
import { serviceAccount } from "./auth_settings";

// Enter your calendar ID below and service account JSON below, see https://github.com/dialogflow/bike-shop/blob/master/README.md#calendar-setup
export const calendarId =
  "ep74adhrt08amoq3p14u9i9uf0@group.calendar.google.com"; // looks like "6ujc6j6rgfk02cp02vg6h38cs0@group.calendar.google.com"
const calendar = google.calendar("v3");
// Set up Google Calendar Service account credentials
const serviceAccountAuth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: "https://www.googleapis.com/auth/calendar",
});

export function getAvailableDays(dateTimeStart, dateTimeEnd) {
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

export function getCalendarEvents(dateTimeStart, dateTimeEnd) {
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

export function createCalendarEvent(
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
            (error, event) => {
              return error ? reject(error) : resolve(event);
            }
          );
        }
      }
    );
  });
}
