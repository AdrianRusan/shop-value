import { Text, Heading, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

interface SubscriptionConfirmationEmailProps {
  firstName?: string;
  email: string;
  subscription: {
    plan: 'pro' | 'enterprise';
    billingCycle: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    startDate: string;
    nextBillingDate: string;
    invoiceUrl?: string;
  };
  features: string[];
  dashboardUrl?: string;
  invoiceUrl?: string;
}

export const SubscriptionConfirmationEmail = ({ 
  firstName = '', 
  email, 
  subscription,
  features,
  dashboardUrl = '',
  invoiceUrl = ''
}: SubscriptionConfirmationEmailProps) => {
  const name = firstName || email.split('@')[0];
  
  const getPlanName = () => {
    return subscription.plan === 'pro' ? 'Pro' : 'Enterprise';
  };

  const getBillingText = () => {
    return subscription.billingCycle === 'monthly' ? 'lunar' : 'anual';
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: currency === 'eur' ? 'EUR' : 'RON'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <BaseLayout 
      title={`Abonament ${getPlanName()} confirmat!`}
      previewText={`Bun venit în planul ${getPlanName()}! Monitorizați mai multe produse cu funcții avansate.`}
    >
      {/* Confirmation Header */}
      <Section style={confirmationHeader}>
        <Text style={successBadge}>✅ Abonament confirmat</Text>
        <Heading style={h1}>
          Bun venit în planul {getPlanName()}, {name}!
        </Heading>
        <Text style={confirmationText}>
          Abonamentul dvs. {getPlanName()} a fost activat cu succes. Acum aveți acces la toate 
          funcțiile avansate pentru monitorizarea prețurilor.
        </Text>
      </Section>

      {/* Subscription Details */}
      <Section style={subscriptionSection}>
        <Heading style={h2}>Detaliile abonamentului</Heading>
        
        <Row>
          <Column style={detailColumn}>
            <Text style={detailLabel}>Plan:</Text>
            <Text style={detailValue}>ShopValue {getPlanName()}</Text>
          </Column>
          <Column style={detailColumn}>
            <Text style={detailLabel}>Facturare:</Text>
            <Text style={detailValue}>{getBillingText()}</Text>
          </Column>
        </Row>

        <Row>
          <Column style={detailColumn}>
            <Text style={detailLabel}>Preț:</Text>
            <Text style={detailValue}>{formatPrice(subscription.amount, subscription.currency)}</Text>
          </Column>
          <Column style={detailColumn}>
            <Text style={detailLabel}>Data începerii:</Text>
            <Text style={detailValue}>{formatDate(subscription.startDate)}</Text>
          </Column>
        </Row>

        <Row>
          <Column style={fullColumn}>
            <Text style={detailLabel}>Următoarea factură:</Text>
            <Text style={detailValue}>{formatDate(subscription.nextBillingDate)}</Text>
          </Column>
        </Row>
      </Section>

      {/* Features Section */}
      <Section style={featuresSection}>
        <Heading style={h2}>Ce puteți face acum:</Heading>
        
        {features.map((feature, index) => (
          <Text key={index} style={featureItem}>
            ✅ {feature}
          </Text>
        ))}
      </Section>

      {/* Quick Actions */}
      <Section style={actionsSection}>
        <Heading style={h2}>Acțiuni rapide</Heading>
        
        <Row>
          <Column style={actionColumn}>
            <Button 
              style={primaryButton} 
              href={dashboardUrl || `${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/dashboard`}
            >
              Accesați dashboard-ul
            </Button>
          </Column>
          <Column style={actionColumn}>
            <Button 
              style={secondaryButton} 
              href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/customer-portal`}
            >
              Gestionați abonamentul
            </Button>
          </Column>
        </Row>

        {invoiceUrl && (
          <Row style={{ marginTop: '16px' }}>
            <Column style={fullColumn}>
              <Button style={invoiceButton} href={invoiceUrl}>
                📄 Descărcați factura
              </Button>
            </Column>
          </Row>
        )}
      </Section>

      {/* Getting Started Tips */}
      <Section style={tipsSection}>
        <Heading style={h2}>Sfaturi pentru a începe:</Heading>
        
        <Text style={tipItem}>
          <strong>1. Adăugați mai multe produse:</strong> Acum puteți monitoriza 
          {subscription.plan === 'pro' ? ' până la 50 de produse' : ' produse nelimitate'}.
        </Text>
        
        <Text style={tipItem}>
          <strong>2. Setați alerte personalizate:</strong> Configurați praguri specifice pentru fiecare produs.
        </Text>
        
        <Text style={tipItem}>
          <strong>3. Explorați istoricul prețurilor:</strong> Vedeți tendințele de preț pentru decizii mai bune.
        </Text>

        {subscription.plan === 'enterprise' && (
          <Text style={tipItem}>
            <strong>4. Folosiți API-ul:</strong> Integrați datele ShopValue în propriile aplicații.
          </Text>
        )}
      </Section>

      {/* Support Section */}
      <Section style={supportSection}>
        <Text style={supportTitle}>Aveți nevoie de ajutor?</Text>
        <Text style={supportText}>
          Echipa noastră de suport premium este aici să vă ajute cu orice întrebări despre 
          funcțiile {getPlanName()}.
        </Text>
        <Text style={supportText}>
          <a href="mailto:support@shopvalue.com" style={supportLink}>
            📧 Contactați suportul premium
          </a>
        </Text>
      </Section>

      {/* Billing Information */}
      <Section style={billingSection}>
        <Text style={billingTitle}>Informații de facturare</Text>
        <Text style={billingText}>
          Abonamentul dvs. va fi reînnoit automat la {formatDate(subscription.nextBillingDate)} 
          pentru {formatPrice(subscription.amount, subscription.currency)}.
        </Text>
        <Text style={billingText}>
          Puteți anula sau modifica abonamentul oricând din 
          <a href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/customer-portal`} style={billingLink}>
            portalul de client
          </a>.
        </Text>
      </Section>
    </BaseLayout>
  );
};

// Styles
const confirmationHeader = {
  textAlign: 'center' as const,
  margin: '0 0 32px 0',
};

const successBadge = {
  backgroundColor: '#059669',
  borderRadius: '20px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '8px 16px',
  margin: '0 0 16px 0',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '36px',
  margin: '0 0 16px 0',
};

const h2 = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '24px 0 16px 0',
};

const confirmationText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const subscriptionSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  margin: '32px 0',
  padding: '24px',
  border: '1px solid #e5e7eb',
};

const detailColumn = {
  padding: '8px 16px 8px 0',
  verticalAlign: 'top' as const,
};

const fullColumn = {
  padding: '8px 0',
};

const detailLabel = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 4px 0',
};

const detailValue = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
};

const featuresSection = {
  margin: '32px 0',
};

const featureItem = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 12px 0',
};

const actionsSection = {
  margin: '32px 0',
};

const actionColumn = {
  textAlign: 'center' as const,
  padding: '0 8px',
};

const primaryButton = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '16px 24px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const secondaryButton = {
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  color: '#374151',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '16px 24px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const invoiceButton = {
  backgroundColor: '#059669',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '12px 20px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const tipsSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '12px',
  margin: '32px 0',
  padding: '24px',
};

const tipItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 16px 0',
};

const supportSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '12px',
  margin: '32px 0',
  padding: '24px',
  textAlign: 'center' as const,
};

const supportTitle = {
  color: '#92400e',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const supportText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const supportLink = {
  color: '#92400e',
  fontWeight: '600',
  textDecoration: 'underline',
};

const billingSection = {
  borderTop: '1px solid #e5e7eb',
  margin: '32px 0 0 0',
  paddingTop: '24px',
};

const billingTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const billingText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const billingLink = {
  color: '#3b82f6',
  textDecoration: 'underline',
};

export default SubscriptionConfirmationEmail;