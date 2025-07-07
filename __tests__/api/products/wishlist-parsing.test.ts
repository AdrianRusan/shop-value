import { describe, test, expect } from '@jest/globals';

// Helper functions extracted from the wishlist route for testing
function createStructuredNotes(category?: string, priority: string = 'medium', userNotes?: string) {
  const structured = {
    category: category || undefined,
    priority,
    notes: userNotes || undefined
  };
  
  // Remove undefined values to keep JSON clean
  Object.keys(structured).forEach(key => 
    structured[key as keyof typeof structured] === undefined && delete structured[key as keyof typeof structured]
  );
  
  return JSON.stringify(structured);
}

function parseStructuredNotes(userNotes?: string) {
  if (!userNotes) {
    return { category: undefined, priority: 'medium', notes: undefined };
  }
  
  try {
    // Try to parse as JSON first (new format)
    const parsed = JSON.parse(userNotes);
    return {
      category: parsed.category || undefined,
      priority: parsed.priority || 'medium',
      notes: parsed.notes || undefined
    };
  } catch {
    // Fallback to old pipe-delimited format for backward compatibility
    const category = userNotes.includes('category:') 
      ? userNotes.split('category:')[1].split('|')[0] 
      : undefined;
    
    const priority = userNotes.includes('priority:')
      ? userNotes.split('priority:')[1].split('|')[0]
      : 'medium';
    
    // Extract notes by removing category and priority metadata
    let notes = userNotes
      .replace(/category:[^|]*\|?/g, '')
      .replace(/priority:[^|]*\|?/g, '')
      .replace(/^\|+|\|+$/g, '') // Remove leading/trailing pipes
      .trim();
    
    return {
      category: category || undefined,
      priority,
      notes: notes || undefined
    };
  }
}

function calculatePriceChangePercentage(currentPrice: number, originalPrice: number): number {
  if (typeof currentPrice !== 'number' || typeof originalPrice !== 'number' || 
      isNaN(currentPrice) || isNaN(originalPrice)) {
    return 0;
  }
  
  if (originalPrice === 0) {
    // If original price is 0, we can't calculate percentage change
    // Return 100% if current price > 0, otherwise 0%
    return currentPrice > 0 ? 100 : 0;
  }
  
  return ((currentPrice - originalPrice) / originalPrice) * 100;
}

describe('Wishlist Parsing and Calculation Fixes', () => {
  describe('createStructuredNotes', () => {
    test('should create JSON format with all fields', () => {
      const result = createStructuredNotes('Electronics', 'high', 'Great product');
      const parsed = JSON.parse(result);
      
      expect(parsed.category).toBe('Electronics');
      expect(parsed.priority).toBe('high');
      expect(parsed.notes).toBe('Great product');
    });

    test('should handle missing category', () => {
      const result = createStructuredNotes(undefined, 'medium', 'Some notes');
      const parsed = JSON.parse(result);
      
      expect(parsed.category).toBeUndefined();
      expect(parsed.priority).toBe('medium');
      expect(parsed.notes).toBe('Some notes');
    });

    test('should handle missing notes', () => {
      const result = createStructuredNotes('Books', 'low');
      const parsed = JSON.parse(result);
      
      expect(parsed.category).toBe('Books');
      expect(parsed.priority).toBe('low');
      expect(parsed.notes).toBeUndefined();
    });
  });

  describe('parseStructuredNotes', () => {
    test('should parse new JSON format correctly', () => {
      const jsonNotes = '{"category":"Electronics","priority":"high","notes":"Great product"}';
      const result = parseStructuredNotes(jsonNotes);
      
      expect(result.category).toBe('Electronics');
      expect(result.priority).toBe('high');
      expect(result.notes).toBe('Great product');
    });

    test('should handle backward compatibility with old pipe format', () => {
      const pipeNotes = 'category:Electronics|priority:high|Some user notes here';
      const result = parseStructuredNotes(pipeNotes);
      
      expect(result.category).toBe('Electronics');
      expect(result.priority).toBe('high');
      expect(result.notes).toBe('Some user notes here');
    });

    test('should handle pipe character in category name (old format)', () => {
      const pipeNotes = 'category:Electronics | Gadgets|priority:high|Notes with | pipes';
      const result = parseStructuredNotes(pipeNotes);
      
      expect(result.category).toBe('Electronics '); // Only first part before pipe
      expect(result.priority).toBe('high');
      expect(result.notes).toBe('Gadgets|Notes with | pipes'); // Everything after category gets lumped into notes
    });

    test('should handle pipe character in category name (new format)', () => {
      const jsonNotes = '{"category":"Electronics | Gadgets","priority":"high","notes":"Notes with | pipes"}';
      const result = parseStructuredNotes(jsonNotes);
      
      expect(result.category).toBe('Electronics | Gadgets'); // Full category preserved
      expect(result.priority).toBe('high');
      expect(result.notes).toBe('Notes with | pipes'); // Full notes preserved
    });

    test('should return defaults for empty input', () => {
      const result = parseStructuredNotes('');
      
      expect(result.category).toBeUndefined();
      expect(result.priority).toBe('medium');
      expect(result.notes).toBeUndefined();
    });

    test('should return defaults for undefined input', () => {
      const result = parseStructuredNotes(undefined);
      
      expect(result.category).toBeUndefined();
      expect(result.priority).toBe('medium');
      expect(result.notes).toBeUndefined();
    });
  });

  describe('calculatePriceChangePercentage', () => {
    test('should calculate positive percentage change correctly', () => {
      const result = calculatePriceChangePercentage(120, 100);
      expect(result).toBe(20);
    });

    test('should calculate negative percentage change correctly', () => {
      const result = calculatePriceChangePercentage(80, 100);
      expect(result).toBe(-20);
    });

    test('should handle originalPrice of 0 correctly', () => {
      const result = calculatePriceChangePercentage(50, 0);
      expect(result).toBe(100); // Should return 100% when original is 0 and current > 0
    });

    test('should handle both prices being 0', () => {
      const result = calculatePriceChangePercentage(0, 0);
      expect(result).toBe(0); // Should return 0% when both are 0
    });

    test('should handle invalid inputs', () => {
      expect(calculatePriceChangePercentage(NaN, 100)).toBe(0);
      expect(calculatePriceChangePercentage(100, NaN)).toBe(0);
      expect(calculatePriceChangePercentage('100' as any, 100)).toBe(0);
      expect(calculatePriceChangePercentage(100, '100' as any)).toBe(0);
    });

    test('should handle decimal prices correctly', () => {
      const result = calculatePriceChangePercentage(33.33, 30);
      expect(result).toBeCloseTo(11.1, 1);
    });
  });
}); 