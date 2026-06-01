import { solveCaptcha } from "@better-vitty/captcha-solver";
import type { AuthSession, LoginResult } from "../lib/types";
import type { LoginOptions } from "../lib/vtopTypes";
import { VtopClient } from "./client";
import { VtopError } from "./errors";
import { extractAuthorizedId, extractCaptchaDataUri, extractCsrf, isRecaptchaPage, tryExtractCsrf } from "./parser";
export type { LoginOptions } from "../lib/vtopTypes";


function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInvalidLogin(html: string): boolean {
  return /invalid\s+(?:username|password|credentials)|login\s+failed|invalid\s+captcha|captcha\s+(?:does not match|mismatch|invalid)/i.test(html);
}

function requiresMandatoryAction(html: string, url: string): boolean {
  return /mandatory\/data\/off|feedback|studentFeedback|redressal|hostel.*instruction/i.test(url + "\n" + html);
}

async function prepareLoginPage(client: VtopClient, options: LoginOptions): Promise<{ csrf: string; captchaDataUri: string }> {
  options.onStatus?.("opening vtop");
  client.clearSession();
  await client.get("/");
  await client.get("/vtop/");
  const openPage = await client.get("/vtop/openPage");
  const setupCsrf = tryExtractCsrf(openPage.text);
  if (setupCsrf) {
    await client.postForm("/vtop/prelogin/setup", { _csrf: setupCsrf, flag: "VTOP" });
  }

  const max = options.maxCaptchaPageAttempts ?? 6;
  for (let attempt = 1; attempt <= max; attempt += 1) {
    options.onStatus?.(`fetching captcha ${attempt}/${max}`);
    const loginPage = await client.get("/vtop/login");
    if (isRecaptchaPage(loginPage.text)) {
      if (attempt < max) await delay(600 * attempt);
      continue;
    }
    const captchaDataUri = extractCaptchaDataUri(loginPage.text);
    if (!captchaDataUri) {
      if (attempt < max) await delay(600 * attempt);
      continue;
    }
    return { csrf: extractCsrf(loginPage.text), captchaDataUri };
  }

  throw new VtopError("CAPTCHA_UNAVAILABLE", "VTOP did not provide a text captcha");
}

function sessionFromHtml(html: string, fallbackCsrf: string): AuthSession {
  return { csrf: tryExtractCsrf(html) ?? fallbackCsrf, authorizedId: extractAuthorizedId(html) };
}

export async function loginToVtop(client: VtopClient, options: LoginOptions): Promise<LoginResult> {
  const max = options.maxCaptchaAttempts ?? 4;
  for (let attempt = 1; attempt <= max; attempt += 1) {
    const loginPage = await prepareLoginPage(client, options);
    options.onStatus?.(`solving captcha ${attempt}/${max}`);
    const captcha = await solveCaptcha(loginPage.captchaDataUri);
    if (captcha.length !== 6) throw new VtopError("CAPTCHA_REJECTED", "captcha solver returned an invalid answer");

    options.onStatus?.("submitting login");
    const loginResponse = await client.postForm("/vtop/login", {
      _csrf: loginPage.csrf,
      username: options.username,
      password: options.password,
      captchaStr: captcha,
    });

    if (requiresMandatoryAction(loginResponse.text, loginResponse.url)) {
      throw new VtopError("MANDATORY_WEB_ACTION", "VTOP requires a mandatory web action before timetable sync");
    }

    if (!/\/vtop\/login/i.test(loginResponse.url) && !isInvalidLogin(loginResponse.text)) {
      const content = loginResponse.text.includes("authorizedID") ? loginResponse : await client.get("/vtop/content");
      return { session: sessionFromHtml(content.text, loginPage.csrf), attempts: attempt };
    }

    client.clearSession();
    if (/invalid\s+(?:username|password|credentials)/i.test(loginResponse.text)) {
      throw new VtopError("INVALID_CREDENTIALS", "invalid VTOP credentials");
    }
  }

  throw new VtopError("CAPTCHA_REJECTED", "VTOP rejected the solved captcha");
}
