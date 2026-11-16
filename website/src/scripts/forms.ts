const endpoint = "https://api.web3forms.com/submit";
const requestTimeoutMs = 15_000;

for (const form of document.querySelectorAll<HTMLFormElement>("[data-contact-form]")) {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!status || !button) continue;

  const idleLabel = button.textContent;
  let pending = false;

  function announce(message: string, state: string) {
    status!.textContent = message;
    status!.dataset.state = state;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    if (form.dataset.configured !== "true") {
      announce("This form is not connected yet. Please check back soon.", "error");
      return;
    }
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(new FormData(form));
    if (values.botcheck) return;
    pending = true;
    button.disabled = true;
    button.textContent = "Sending…";
    form.setAttribute("aria-busy", "true");
    announce("Sending your details…", "pending");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("success" in result) || result.success !== true) {
        throw new Error("Submission rejected");
      }
      form.reset();
      announce(
        form.dataset.formKind === "signup"
          ? "Thanks! Your request for launch updates has been received."
          : "Message received. Thanks for getting in touch!",
        "success",
      );
    } catch {
      announce(
        controller.signal.aborted
          ? "The request timed out. Your details are still here; please try again."
          : "We couldn't confirm delivery. Your details are still here; please try again.",
        "error",
      );
    } finally {
      window.clearTimeout(timeout);
      pending = false;
      button.disabled = false;
      button.textContent = idleLabel;
      form.removeAttribute("aria-busy");
    }
  });
}
