import { dateAndTimeHandler } from "./date-and-time-handler";
import { dateOnlyHandler } from "./date-only-handler";
import { timePeriodOnlyHandler } from "./time-period-only-handler";
import { timeOnlyHandler } from "./time-only-handler";

export function pickDateInput(agent) {
  console.log("FUNCTION pickDateInput");

  console.log("parameters");
  console.log(agent.parameters);
  const appointmentContext = agent.context.get("appointment");
  console.log("appointment context:");
  console.log(appointmentContext);

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
    dateAndTimeHandler(agent, appointmentType, appointmentContext);
  }
  // TODO if date && time-period, show up to 5 available appointments
  // TODO if ONLY date-period, show next 5 available appointments
  // TODO if date-period && time, show up to 5 available appointments
  // TODO if date-period && time-period, show up to 5 available appointments

  // if ONLY date, show up to 5 available appointments
  if (agent.parameters.date) {
    dateOnlyHandler(agent);
  }
  // if ONLY time period, show next 5 available appointments
  if (agent.parameters["time-period"]) {
    timePeriodOnlyHandler(agent);
  }
  // if ONLY time, find next 5 available appointments
  if (agent.parameters.time) {
    timeOnlyHandler(agent);
  } else {
    console.log(agent.parameters);
    // agent.add("Okay!");
  }
  return null;
}
