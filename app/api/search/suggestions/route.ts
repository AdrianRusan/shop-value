import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/actions';

interface SearchSuggestion {
  type: 'brand' | 'product' | 'popular';
  text: string;
  label: string;
  brand?: string;
  category: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const searchResults = await searchProducts(query.trim());
    
    // Format suggestions for auto-complete
    const suggestions: SearchSuggestion[] = [];
    
    // Add brand suggestions
    if (searchResults.brands && searchResults.brands.length > 0) {
      searchResults.brands.slice(0, 3).forEach((brand: string) => {
        suggestions.push({
          type: 'brand',
          text: brand,
          label: brand,
          category: 'Branduri'
        });
      });
    }
    
    // Add product model suggestions
    if (searchResults.brandModelObjects && searchResults.brandModelObjects.length > 0) {
      searchResults.brandModelObjects.slice(0, 4).forEach((item: any) => {
        suggestions.push({
          type: 'product',
          text: `${item.brand} ${item.model}`,
          label: item.model,
          brand: item.brand,
          category: 'Produse'
        });
      });
    }
    
    // Add top searched products
    if (searchResults.topSearchedProducts && searchResults.topSearchedProducts.length > 0) {
      searchResults.topSearchedProducts.slice(0, 3).forEach((product: any) => {
        suggestions.push({
          type: 'popular',
          text: `${product.brand} ${product.productModel}`,
          label: product.productModel,
          brand: product.brand,
          category: 'Popular'
        });
      });
    }
    
    // Remove duplicates based on text
    const uniqueSuggestions = suggestions.filter((suggestion, index, arr) => 
      index === arr.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
    );
    
    return NextResponse.json({ 
      suggestions: uniqueSuggestions.slice(0, 8) // Limit to 8 suggestions
    });
    
  } catch (error) {
    console.error('Search suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search suggestions' },
      { status: 500 }
    );
  }
}