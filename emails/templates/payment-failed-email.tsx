import { Text, Heading, Button, Section } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

interface PaymentFailedEmailProps {
  firstName?: string;
  email: string;
  subscription: {
    plan: 'pro' | 'enterprise';
    amount: number;
    currency: string;
    nextAttempt?: string;
    retryUrl?: string;
  };
  failureReason?: string;
  retryUrl?: string;
}

export const PaymentFailedEmail = ({ 
  firstName = '', 
  email, 
  subscription,
  failureReason = 'Fonduri insuficiente sau problemă cu cardul',
  retryUrl = ''
}: PaymentFailedEmailProps) => {
  const name = firstName || email.split('@')[0];
  
  const getPlanName = () => {
    return subscription.plan === 'pro' ? 'Pro' : 'Enterprise';
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <BaseLayout 
      title="Problemă cu plata abonamentului"
      previewText="Actualizați metoda de plată pentru a continua să folosiți ShopValue Pro"
    >
      {/* Alert Header */}
      <Section style={alertHeader}>
        <Text style={warningBadge}>⚠️ Plată nereușită</Text>
        <Heading style={h1}>
          Problemă cu plata, {name}
        </Heading>
        <Text style={alertText}>
          Nu am putut procesa plata pentru abonamentul dvs. ShopValue {getPlanName()}. 
          Vă rugăm să actualizați metoda de plată pentru a evita întreruperea serviciului.
        </Text>
      </Section>

      {/* Payment Details */}
      <Section style={paymentSection}>
        <Heading style={h2}>Detaliile plății</Heading>
        
        <Text style={detailItem}>
          <strong>Abonament:</strong> ShopValue {getPlanName()}
        </Text>
        <Text style={detailItem}>
          <strong>Suma:</strong> {formatPrice(subscription.amount, subscription.currency)}
        </Text>
        <Text style={detailItem}>
          <strong>Motivul refuzului:</strong> {failureReason}
        </Text>
        {subscription.nextAttempt && (
          <Text style={detailItem}>
            <strong>Următoarea încercare:</strong> {formatDate(subscription.nextAttempt)}
          </Text>
        )}
      </Section>

      {/* Urgent Action Required */}
      <Section style={urgentSection}>
        <Heading style={h2}>🚨 Acțiune urgentă necesară</Heading>
        
        <Text style={urgentText}>
          Pentru a evita întreruperea serviciului, vă rugăm să actualizați metoda de plată 
          în următoarele <strong>48 de ore</strong>.
        </Text>

        <Text style={consequenceText}>
          Dacă nu actualizați metoda de plată, contul dvs. va fi retrogradat la planul gratuit și:
        </Text>

        <Text style={consequenceItem}>❌ Veți putea monitoriza doar 5 produse</Text>
        <Text style={consequenceItem}>❌ Veți pierde accesul la funcțiile avansate</Text>
        <Text style={consequenceItem}>❌ Istoricul extins de prețuri nu va mai fi disponibil</Text>
        {subscription.plan === 'enterprise' && (
          <Text style={consequenceItem}>❌ Accesul la API va fi suspendat</Text>
        )}
      </Section>

      {/* CTA Buttons */}
      <Section style={ctaSection}>
        <Button 
          style={primaryButton} 
          href={retryUrl || `${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/customer-portal`}
        >
          Actualizați metoda de plată
        </Button>
        
        <Text style={ctaHelper}>
          Puteți actualiza cardul sau adăuga o nouă metodă de plată în portalul de client.
        </Text>
      </Section>

      {/* Common Issues */}
      <Section style={helpSection}>
        <Heading style={h2}>Cauze comune și soluții</Heading>
        
        <Text style={helpItem}>
          <strong>Fonduri insuficiente:</strong> Verificați soldul contului sau folosiți un alt card.
        </Text>
        
        <Text style={helpItem}>
          <strong>Card expirat:</strong> Adăugați un card nou cu o dată de expirare validă.
        </Text>
        
        <Text style={helpItem}>
          <strong>Tranzacție blocată de bancă:</strong> Contactați banca pentru a autoriza plata.
        </Text>
        
        <Text style={helpItem}>
          <strong>Informații incorecte:</strong> Verificați numărul cardului și datele de facturare.
        </Text>
      </Section>

      {/* Support Section */}
      <Section style={supportSection}>
        <Text style={supportTitle}>Aveți nevoie de ajutor?</Text>
        <Text style={supportText}>
          Dacă întâmpinați probleme cu actualizarea metodei de plată, echipa noastră de 
          suport este aici să vă ajute.
        </Text>
        
        <Button 
          style={supportButton} 
          href="mailto:support@shopvalue.com?subject=Problemă cu plata abonamentului"
        >
          📧 Contactați suportul
        </Button>
        
        <Text style={supportNote}>
          De obicei răspundem în mai puțin de 2 ore în timpul programului de lucru.
        </Text>
      </Section>

      {/* Account Status */}
      <Section style={statusSection}>
        <Text style={statusTitle}>Statusul contului</Text>
        <Text style={statusText}>
          Contul dvs. rămâne activ pentru încă <strong>48 de ore</strong>. După această 
          perioadă, veți fi automat trecut la planul gratuit până când problema cu plata 
          este rezolvată.
        </Text>
        <Text style={statusText}>
          Odată ce actualizați metoda de plată, toate funcțiile {getPlanName()} vor fi 
          restaurate imediat.
        </Text>
      </Section>

      {/* Alternative Actions */}
      <Section style={alternativeSection}>
        <Text style={alternativeTitle}>Alternative</Text>
        <Text style={alternativeText}>
          Dacă nu doriți să continuați cu abonamentul {getPlanName()}, puteți:
        </Text>
        
        <Text style={alternativeItem}>
          • <a href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/customer-portal`} style={alternativeLink}>
            Anula abonamentul
          </a> și trece la planul gratuit
        </Text>
        
        <Text style={alternativeItem}>
          • <a href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/pricing`} style={alternativeLink}>
            Downgrade la un plan mai mic
          </a> dacă costul este o problemă
        </Text>
      </Section>
    </BaseLayout>
  );
};

// Styles
const alertHeader = {
  textAlign: 'center' as const,
  margin: '0 0 32px 0',
};

const warningBadge = {
  backgroundColor: '#dc2626',
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

const alertText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const paymentSection = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  border: '1px solid #fecaca',
  margin: '32px 0',
  padding: '20px',
};

const detailItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const urgentSection = {
  backgroundColor: '#fff7ed',
  borderRadius: '8px',
  border: '2px solid #fed7aa',
  margin: '32px 0',
  padding: '24px',
};

const urgentText = {
  color: '#ea580c',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const consequenceText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px 0',
};

const consequenceItem = {
  color: '#dc2626',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const ctaSection = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const primaryButton = {
  backgroundColor: '#dc2626',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '18px',
  fontWeight: '700',
  lineHeight: '1',
  padding: '16px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const ctaHelper = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0 0',
};

const helpSection = {
  margin: '32px 0',
};

const helpItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 12px 0',
};

const supportSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  margin: '32px 0',
  padding: '24px',
  textAlign: 'center' as const,
};

const supportTitle = {
  color: '#1e40af',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const supportText = {
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 16px 0',
};

const supportButton = {
  backgroundColor: '#3b82f6',
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

const supportNote = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '12px 0 0 0',
};

const statusSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '32px 0',
  padding: '20px',
};

const statusTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const statusText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px 0',
};

const alternativeSection = {
  borderTop: '1px solid #e5e7eb',
  margin: '32px 0 0 0',
  paddingTop: '24px',
};

const alternativeTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const alternativeText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px 0',
};

const alternativeItem = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
};

const alternativeLink = {
  color: '#3b82f6',
  textDecoration: 'underline',
};

export default PaymentFailedEmail;