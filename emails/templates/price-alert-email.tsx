import { Text, Heading, Button, Section, Img, Row, Column } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

interface PriceAlertEmailProps {
  firstName?: string;
  email: string;
  product: {
    id: string;
    title: string;
    brand: string;
    currentPrice: number;
    originalPrice: number;
    targetPrice?: number;
    url: string;
    image?: string;
    availability?: string;
  };
  alertType: 'target_reached' | 'significant_drop' | 'lowest_price' | 'back_in_stock';
  discountPercentage?: number;
}

export const PriceAlertEmail = ({ 
  firstName = '', 
  email, 
  product,
  alertType,
  discountPercentage 
}: PriceAlertEmailProps) => {
  const name = firstName || email.split('@')[0];
  
  const getAlertTitle = () => {
    switch (alertType) {
      case 'target_reached':
        return '🎯 Prețul țintă atins!';
      case 'significant_drop':
        return '📉 Reducere semnificativă de preț!';
      case 'lowest_price':
        return '💰 Cel mai mic preț vreodată!';
      case 'back_in_stock':
        return '📦 Produsul este din nou în stoc!';
      default:
        return '🔔 Alertă de preț';
    }
  };

  const getAlertDescription = () => {
    switch (alertType) {
      case 'target_reached':
        return `Produsul "${product.title}" a atins prețul țintă de ${product.targetPrice?.toFixed(2)}€!`;
      case 'significant_drop':
        return `Produsul "${product.title}" are o reducere de ${discountPercentage}%!`;
      case 'lowest_price':
        return `Produsul "${product.title}" este la cel mai mic preț înregistrat vreodată!`;
      case 'back_in_stock':
        return `Produsul "${product.title}" este din nou disponibil pentru comandă!`;
      default:
        return `Avem o actualizare pentru produsul "${product.title}".`;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(price);
  };

  const savings = product.originalPrice - product.currentPrice;
  const savingsPercentage = ((savings / product.originalPrice) * 100).toFixed(0);

  return (
    <BaseLayout 
      title={getAlertTitle()}
      previewText={getAlertDescription()}
    >
      {/* Alert Header */}
      <Section style={alertHeader}>
        <Text style={alertBadge}>{getAlertTitle()}</Text>
        <Heading style={h1}>
          {name}, e momentul să cumpărați!
        </Heading>
        <Text style={alertDescription}>
          {getAlertDescription()}
        </Text>
      </Section>

      {/* Product Information */}
      <Section style={productSection}>
        <Row>
          {product.image && (
            <Column style={imageColumn}>
              <Img
                src={product.image}
                alt={product.title}
                style={productImage}
              />
            </Column>
          )}
          <Column style={productInfo}>
            <Text style={brandName}>{product.brand}</Text>
            <Heading style={productTitle}>{product.title}</Heading>
            
            {/* Price Information */}
            <Section style={priceSection}>
              <Row>
                <Column>
                  <Text style={currentPriceLabel}>Prețul curent:</Text>
                  <Text style={currentPrice}>{formatPrice(product.currentPrice)}</Text>
                </Column>
                {product.originalPrice !== product.currentPrice && (
                  <Column>
                    <Text style={originalPriceLabel}>Prețul original:</Text>
                    <Text style={originalPrice}>{formatPrice(product.originalPrice)}</Text>
                  </Column>
                )}
              </Row>
            </Section>

            {/* Savings Information */}
            {savings > 0 && (
              <Section style={savingsSection}>
                <Text style={savingsText}>
                  💰 Economisiți: <span style={savingsAmount}>{formatPrice(savings)}</span> ({savingsPercentage}%)
                </Text>
              </Section>
            )}

            {/* Target Price Info */}
            {alertType === 'target_reached' && product.targetPrice && (
              <Section style={targetSection}>
                <Text style={targetText}>
                  ✅ Prețul țintă de {formatPrice(product.targetPrice)} a fost atins!
                </Text>
              </Section>
            )}

            {/* Availability */}
            {product.availability && (
              <Text style={availability}>
                Disponibilitate: <span style={availabilityStatus}>{product.availability}</span>
              </Text>
            )}
          </Column>
        </Row>
      </Section>

      {/* Call to Action */}
      <Section style={ctaSection}>
        <Button style={ctaButton} href={product.url}>
          Cumpărați acum pe site
        </Button>
        <Text style={urgencyText}>
          ⏰ Nu ratați această ofertă - prețurile se pot schimba oricând!
        </Text>
      </Section>

      {/* Additional Actions */}
      <Section style={actionsSection}>
        <Row>
          <Column style={actionColumn}>
            <Button 
              style={secondaryButton} 
              href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/produse/${product.id}`}
            >
              Vezi istoric prețuri
            </Button>
          </Column>
          <Column style={actionColumn}>
            <Button 
              style={secondaryButton} 
              href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/dashboard`}
            >
              Gestionează alertele
            </Button>
          </Column>
        </Row>
      </Section>

      {/* Footer Note */}
      <Section style={footerNote}>
        <Text style={noteText}>
          Această alertă a fost generată automat pe baza preferințelor dvs. de monitorizare. 
          Prețurile și disponibilitatea pot varia în funcție de magazin.
        </Text>
        <Text style={noteText}>
          Pentru a opri alertele pentru acest produs, 
          <a href={`${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/unsubscribe?product=${product.id}`} style={unsubscribeLink}>
            click aici
          </a>.
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

const alertBadge = {
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

const alertDescription = {
  color: '#374151',
  fontSize: '18px',
  lineHeight: '26px',
  margin: '0',
};

const productSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  margin: '32px 0',
  padding: '24px',
  border: '2px solid #e5e7eb',
};

const imageColumn = {
  width: '150px',
  verticalAlign: 'top' as const,
};

const productImage = {
  borderRadius: '8px',
  maxWidth: '120px',
  height: 'auto',
};

const productInfo = {
  paddingLeft: '20px',
  verticalAlign: 'top' as const,
};

const brandName = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const productTitle = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '0 0 20px 0',
};

const priceSection = {
  margin: '16px 0',
};

const currentPriceLabel = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 4px 0',
};

const currentPrice = {
  color: '#dc2626',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 16px 0',
};

const originalPriceLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 4px 0',
};

const originalPrice = {
  color: '#6b7280',
  fontSize: '16px',
  textDecoration: 'line-through',
  margin: '0 0 16px 0',
};

const savingsSection = {
  backgroundColor: '#dcfce7',
  borderRadius: '8px',
  padding: '12px',
  margin: '16px 0',
};

const savingsText = {
  color: '#166534',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  textAlign: 'center' as const,
};

const savingsAmount = {
  fontSize: '18px',
  fontWeight: '700',
};

const targetSection = {
  backgroundColor: '#dbeafe',
  borderRadius: '8px',
  padding: '12px',
  margin: '16px 0',
};

const targetText = {
  color: '#1e40af',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  textAlign: 'center' as const,
};

const availability = {
  color: '#374151',
  fontSize: '14px',
  margin: '16px 0 0 0',
};

const availabilityStatus = {
  fontWeight: '600',
  color: '#059669',
};

const ctaSection = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const ctaButton = {
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
  textTransform: 'uppercase' as const,
};

const urgencyText = {
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: '600',
  margin: '16px 0 0 0',
};

const actionsSection = {
  margin: '24px 0',
};

const actionColumn = {
  textAlign: 'center' as const,
  padding: '0 8px',
};

const secondaryButton = {
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  color: '#374151',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '12px 20px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const footerNote = {
  borderTop: '1px solid #e5e7eb',
  margin: '32px 0 0 0',
  paddingTop: '24px',
};

const noteText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const unsubscribeLink = {
  color: '#6b7280',
  textDecoration: 'underline',
};

export default PriceAlertEmail;