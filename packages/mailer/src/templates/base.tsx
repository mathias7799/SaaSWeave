/** @jsxImportSource react */
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text
} from "react-email";

type ReactNode = React.ReactNode;

const BRAND = "#e5590a";
const INK = "#1c1917";
const MUTED = "#78716c";
const BORDER = "#e7e5e4";
const BG = "#faf9f7";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BG,
          color: INK,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "32px 0"
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            margin: "0 auto",
            maxWidth: 480,
            padding: "32px"
          }}
        >
          <Section>
            <Text style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              <span style={{ color: MUTED }}>By</span>
              <span style={{ color: INK }}>Niche</span>
            </Text>
          </Section>
          {children}
          <Hr style={{ borderColor: BORDER, margin: "28px 0 16px" }} />
          <Text style={{ color: MUTED, fontSize: 12, margin: 0 }}>
            You're receiving this because you have a SaaSWeave account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: "20px 0 8px" }}
    >
      {children}
    </Heading>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: "#44403c", fontSize: 15, lineHeight: "24px", margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: BRAND,
        borderRadius: 8,
        color: "#ffffff",
        display: "inline-block",
        fontSize: 15,
        fontWeight: 600,
        padding: "11px 20px",
        textDecoration: "none"
      }}
    >
      {children}
    </Button>
  );
}
