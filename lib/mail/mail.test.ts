import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleProvider } from "./console";
import { providerFor, sendMail } from "./index";
import { nodemailerProvider } from "./nodemailer";
import { invitationEmail, magicLinkEmail } from "./templates";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("routing", () => {
  it("never hands a .test address to SMTP", () => {
    expect(providerFor("avery@clarity.test")).toBe(consoleProvider);
    expect(providerFor("AVERY@CLARITY.TEST")).toBe(consoleProvider);
  });

  it("sending to a .test address does not touch the SMTP provider", async () => {
    const smtp = vi.spyOn(nodemailerProvider, "send").mockResolvedValue();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sendMail(magicLinkEmail({ to: "jordan@clarity.test", url: "http://localhost:3014/api/auth/callback/nodemailer?token=t" }));
    expect(smtp).not.toHaveBeenCalled();
  });

  it("drops .test mail entirely in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fresh = await import("./index");
    expect(fresh.providerFor("taylor@clarity.test")).toBeNull();
  });
});

describe("templates", () => {
  it("escapes names that reach HTML", () => {
    const mail = invitationEmail({
      to: "a@b.co",
      url: "http://localhost:3014/invite/abc",
      orgName: "<script>Acme</script>",
      inviterName: "Avery & Co",
      roleLabel: "member",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;Acme&lt;/script&gt;");
    expect(mail.html).toContain("Avery &amp; Co");
    expect(mail.text).toContain("http://localhost:3014/invite/abc");
  });

  it("the magic link names the host it signs in to", () => {
    const mail = magicLinkEmail({ to: "a@b.co", url: "https://clarity.example.com/api/auth/callback/nodemailer?token=x" });
    expect(mail.subject).toBe("Your Clarity sign-in link");
    expect(mail.html).toContain("clarity.example.com");
  });
});

describe("nodemailer 10 smoke test (no mail is sent)", () => {
  it("creates an SMTP transport from our config shape", () => {
    const transport = nodemailer.createTransport({ host: "smtp.example.com", port: 465, secure: true, auth: { user: "u", pass: "p" } });
    expect(transport.transporter.name).toBe("SMTP");
    transport.close();
  });

  it("next-auth's Nodemailer provider builds against it", async () => {
    const { default: Nodemailer } = await import("next-auth/providers/nodemailer");
    const provider = Nodemailer({
      server: { host: "smtp.example.com", port: 587, auth: { user: "u", pass: "p" } },
      from: "Clarity <u@example.com>",
      sendVerificationRequest: async () => {},
    });
    expect(provider.id).toBe("nodemailer");
    expect(provider.type).toBe("email");
  });
});
