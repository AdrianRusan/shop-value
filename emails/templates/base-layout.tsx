import { Html, Head, Body, Container, Section, Img, Text, Link, Hr } from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  children: React.ReactNode;
  title?: string;
  previewText?: string;
}

export const BaseLayout = ({ children, title = 'ShopValue', previewText }: BaseLayoutProps) => {
  return (
    <Html>
      <Head>
        <title>{title}</title>
        {previewText && <meta name="description" content={previewText} />}
      </Head>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/logo.png`}
              width="120"
              height="40"
              alt="ShopValue"
              style={logo}
            />
            <Text style={tagline}>Monitorizați prețurile inteligent</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              © 2024 ShopValue. Toate drepturile rezervate.
            </Text>
            <Text style={footerText}>
              <Link href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/unsubscribe`} style={link}>
                Dezabonare
              </Link>
              {' • '}
              <Link href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/privacy`} style={link}>
                Politica de confidențialitate
              </Link>
              {' • '}
              <Link href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/contact`} style={link}>
                Contact
              </Link>
            </Text>
            <Text style={footerAddress}>
              ShopValue SRL<br />
              București, România
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #f0f0f0',
  borderRadius: '8px',
  margin: '40px auto',
  padding: '20px',
  width: '600px',
};

const header = {
  textAlign: 'center' as const,
  marginBottom: '32px',
  paddingBottom: '20px',
  borderBottom: '1px solid #eaeaea',
};

const logo = {
  margin: '0 auto',
};

const tagline = {
  color: '#666666',
  fontSize: '14px',
  fontWeight: '400',
  lineHeight: '24px',
  margin: '8px 0 0 0',
};

const content = {
  margin: '32px 0',
};

const hr = {
  border: 'none',
  borderTop: '1px solid #eaeaea',
  margin: '32px 0',
};

const footer = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0 0 8px 0',
};

const footerAddress = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '16px 0 0 0',
};

const link = {
  color: '#556cd6',
  textDecoration: 'underline',
};

export default BaseLayout;