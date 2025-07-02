import { Text, Heading, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

interface WelcomeEmailProps {
  firstName?: string;
  email: string;
  loginUrl?: string;
  dashboardUrl?: string;
}

export const WelcomeEmail = ({ 
  firstName = '', 
  email, 
  loginUrl = '',
  dashboardUrl = '' 
}: WelcomeEmailProps) => {
  const name = firstName || email.split('@')[0];

  return (
    <BaseLayout 
      title="Bun venit la ShopValue!" 
      previewText="Începeți să monitorizați prețurile inteligent cu ShopValue"
    >
      {/* Welcome Message */}
      <Heading style={h1}>
        Bun venit la ShopValue, {name}! 🎉
      </Heading>

      <Text style={text}>
        Vă mulțumim că v-ați alăturat comunității ShopValue! Sunteți pe punctul de a descoperi 
        cel mai inteligent mod de a monitoriza prețurile produselor din România.
      </Text>

      {/* Getting Started Section */}
      <Section style={section}>
        <Heading style={h2}>Cum să începeți:</Heading>
        
        <Row>
          <Column style={stepColumn}>
            <Text style={stepNumber}>1</Text>
          </Column>
          <Column style={stepContent}>
            <Text style={stepTitle}>Adăugați primul produs</Text>
            <Text style={stepDescription}>
              Copiați URL-ul unui produs de pe site-uri precum eMAG, Flip.ro, Altex și urmăriți-i prețul.
            </Text>
          </Column>
        </Row>

        <Row>
          <Column style={stepColumn}>
            <Text style={stepNumber}>2</Text>
          </Column>
          <Column style={stepContent}>
            <Text style={stepTitle}>Setați alertele</Text>
            <Text style={stepDescription}>
              Configurați prețul dorit și veți primi notificări automate când prețul scade.
            </Text>
          </Column>
        </Row>

        <Row>
          <Column style={stepColumn}>
            <Text style={stepNumber}>3</Text>
          </Column>
          <Column style={stepContent}>
            <Text style={stepTitle}>Economisiți bani</Text>
            <Text style={stepDescription}>
              Cumpărați la momentul potrivit și economisiți până la 50% din prețul original.
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Benefits Section */}
      <Section style={benefitsSection}>
        <Heading style={h2}>De ce să alegeți ShopValue?</Heading>
        
        <Text style={benefitItem}>✅ Monitorizare automată 24/7</Text>
        <Text style={benefitItem}>✅ Alertele nu vă costă nimic</Text>
        <Text style={benefitItem}>✅ Suport pentru toate magazinele principale</Text>
        <Text style={benefitItem}>✅ Istoric complet de prețuri</Text>
        <Text style={benefitItem}>✅ Interfață simplă și intuitivă</Text>
      </Section>

      {/* CTA Button */}
      <Section style={buttonSection}>
        <Button 
          style={button} 
          href={dashboardUrl || loginUrl || `${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/dashboard`}
        >
          Începeți să monitorizați acum
        </Button>
      </Section>

      {/* Account Details */}
      <Section style={accountSection}>
        <Text style={accountTitle}>Detaliile contului dvs.:</Text>
        <Text style={accountDetail}>
          <strong>Email:</strong> {email}
        </Text>
        <Text style={accountDetail}>
          <strong>Planul curent:</strong> Gratuit (5 produse)
        </Text>
        <Text style={upgradeText}>
          Doriți să monitorizați mai multe produse? 
          <a href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/pricing`} style={upgradeLink}>
            Actualizați-vă la Pro
          </a>
        </Text>
      </Section>

      {/* Support Section */}
      <Section style={supportSection}>
        <Text style={supportText}>
          Aveți întrebări? Echipa noastră de suport este aici să vă ajute!
        </Text>
        <Text style={supportText}>
          Contactați-ne la: 
          <a href="mailto:support@shopvalue.com" style={supportLink}>
            support@shopvalue.com
          </a>
        </Text>
      </Section>
    </BaseLayout>
  );
};

// Styles
const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '36px',
  margin: '0 0 20px 0',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '24px 0 16px 0',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const section = {
  margin: '32px 0',
};

const stepColumn = {
  width: '60px',
  verticalAlign: 'top' as const,
};

const stepContent = {
  verticalAlign: 'top' as const,
};

const stepNumber = {
  backgroundColor: '#3b82f6',
  borderRadius: '50%',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  height: '40px',
  lineHeight: '40px',
  textAlign: 'center' as const,
  width: '40px',
  margin: '0',
  display: 'inline-block',
};

const stepTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const stepDescription = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 20px 0',
};

const benefitsSection = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  margin: '32px 0',
  padding: '24px',
};

const benefitItem = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 12px 0',
};

const buttonSection = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '16px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const accountSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '32px 0',
  padding: '20px',
};

const accountTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px 0',
};

const accountDetail = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const upgradeText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0 0',
};

const upgradeLink = {
  color: '#3b82f6',
  fontWeight: '600',
  textDecoration: 'underline',
};

const supportSection = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const supportText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const supportLink = {
  color: '#3b82f6',
  textDecoration: 'underline',
};

export default WelcomeEmail;