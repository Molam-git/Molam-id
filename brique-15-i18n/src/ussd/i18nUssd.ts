// USSD/SMS i18n renderer

import { I18nService } from "../i18n/i18n.service";

export interface UssdPage {
  text: string;              // ≤ 182 chars recommended
  next?: string;             // state machine key
  end?: boolean;
}

export class UssdI18n {
  constructor(private i18n: I18nService) {}

  async render(
    moduleSlug: string,
    state: string,
    ctx: any,
    localesChain: string[]
  ): Promise<UssdPage> {
    const map = await this.i18n.resolve({
      module: moduleSlug,
      namespace: "ussd",
      localesChain,
      channel: "ussd",
    });

    const title = map[`ussd.${state}.title`] || "";
    const lines: string[] = [];
    let idx = 1;

    // Collect options
    while (map[`ussd.${state}.opt${idx}`]) {
      lines.push(`${idx}. ${map[`ussd.${state}.opt${idx}`]}`);
      idx++;
    }

    const tail = map[`ussd.${state}.tail`] || "";
    const text = [title, ...lines, tail]
      .filter(Boolean)
      .join("\n")
      .slice(0, 182); // USSD max length

    const end = map[`ussd.${state}.end`] === "true";
    const next = map[`ussd.${state}.next`] || undefined;

    return { text, end, next };
  }

  /**
   * Render SMS template with variable substitution
   */
  async renderSms(
    moduleSlug: string,
    templateKey: string,
    vars: Record<string, any>,
    localesChain: string[]
  ): Promise<string> {
    const map = await this.i18n.resolve({
      module: moduleSlug,
      namespace: "sms",
      localesChain,
      channel: "sms",
    });

    let template = map[`sms.${templateKey}`] || templateKey;

    // Simple variable substitution
    for (const [key, value] of Object.entries(vars)) {
      template = template.replace(new RegExp(`{${key}}`, "g"), String(value));
    }

    // Truncate to SMS limit
    return template.slice(0, 160);
  }
}
