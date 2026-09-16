const form = document.getElementById("consultationForm");
const steps = Array.from(document.querySelectorAll(".form-step"));
const stepLabel = document.getElementById("stepLabel");
const stepName = document.getElementById("stepName");
const progressBar = document.getElementById("progressBar");
const errorBox = document.getElementById("formError");
const submitButton = document.getElementById("submitButton");
const successState = document.getElementById("successState");
const formStartedAt = Date.now();
let currentStep = 0;

const stepNames = ["Your details", "Your wedding"];

function showStep(index) {
  currentStep = index;

  steps.forEach((step, stepIndex) => {
    const active = stepIndex === index;
    step.hidden = !active;
    step.classList.toggle("is-active", active);
  });

  stepLabel.textContent = `Step ${index + 1} of ${steps.length}`;
  stepName.textContent = stepNames[index];
  progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  errorBox.hidden = true;

  const firstInput = steps[index].querySelector("input, select, textarea");
  if (firstInput) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => firstInput.focus({ preventScroll: true }), 420);
  }
}

function validateStep(step) {
  const fields = Array.from(step.querySelectorAll("input, select, textarea"));
  const invalidField = fields.find((field) => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    invalidField.focus();
    return false;
  }

  return true;
}

document.querySelector("[data-next]").addEventListener("click", () => {
  if (validateStep(steps[currentStep])) showStep(1);
});

document.querySelector("[data-back]").addEventListener("click", () => showStep(0));

const weddingDate = document.getElementById("weddingDate");
const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
weddingDate.min = today.toISOString().split("T")[0];

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateStep(steps[currentStep])) return;

  const submitLabel = submitButton.querySelector(".submit-label");
  const submitLoading = submitButton.querySelector(".submit-loading");
  submitButton.disabled = true;
  submitLabel.hidden = true;
  submitLoading.hidden = false;
  errorBox.hidden = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.consent = formData.get("consent") === "on";
  payload.startedAt = formStartedAt;

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "We couldn’t send your enquiry. Please try again.");
    }

    form.hidden = true;
    document.querySelector(".progress-wrap").hidden = true;
    successState.hidden = false;
    successState.focus?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    errorBox.textContent = error.message || "Something went wrong. Please try again or email hello@yayintov.com.";
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    submitButton.disabled = false;
    submitLabel.hidden = false;
    submitLoading.hidden = true;
  }
});
