export function cleanDisplayText(text: string): string {
  if (!text) return '';

  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1');
  cleaned = cleaned.replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1');
  cleaned = cleaned.replace(/^\s*[*•]\s+/gm, '- ');
  cleaned = cleaned.replace(/^\s*#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

function titleCasePhrase(value: string): string {
  return value.replace(/_/g, ' ').trim().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAssistantResponse(payload: any): string {
  if (!payload) return 'No response available.';
  if (typeof payload === 'string') return cleanDisplayText(payload);

  if (payload.text) return cleanDisplayText(String(payload.text));

  if (payload.plan && Array.isArray(payload.plan)) {
    const lines = ['Your Meal Plan:', ''];
    payload.plan.forEach((day: any) => {
      lines.push(`Day ${day.day ?? '?'}`);
      Object.entries(day.meals || {}).forEach(([mealType, meal]) => {
        lines.push(`- ${titleCasePhrase(mealType)}: ${meal}`);
      });
      lines.push('');
    });

    if (Array.isArray(payload.guidance) && payload.guidance.length > 0) {
      lines.push('Helpful Tips:');
      payload.guidance.forEach((tip: string) => lines.push(`- ${tip}`));
    }

    return cleanDisplayText(lines.join('\n'));
  }

  if ('risk' in payload && 'direct_allergen_matches' in payload) {
    const lines = [`Ingredient Safety Check: ${titleCasePhrase(String(payload.risk))} Risk`, ''];

    if (payload.direct_allergen_matches?.length) {
      lines.push('Direct allergen matches:');
      payload.direct_allergen_matches.forEach((item: string) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (payload.cross_reactive_matches?.length) {
      lines.push('Possible cross-reactive matches:');
      payload.cross_reactive_matches.forEach((item: any) => {
        lines.push(`- ${item.ingredient} (linked to ${item.linked_allergen})`);
      });
      lines.push('');
    }

    if (payload.label_warnings?.length) {
      lines.push('Label warnings found:');
      payload.label_warnings.forEach((item: string) => lines.push(`- ${item}`));
      lines.push('');
    }

    lines.push(
      payload.safe_to_consider
        ? 'This looks generally safe based on your known allergens, but always double-check labels.'
        : 'Use caution with this product and review ingredients with your clinician if unsure.'
    );

    return cleanDisplayText(lines.join('\n'));
  }

  if (payload.recommended_steps) {
    const lines = ['Emergency Guidance:', ''];
    if (payload.is_emergency) {
      lines.push('This may be a severe reaction. Seek emergency care immediately.', '');
    }
    payload.recommended_steps.forEach((step: string, index: number) => {
      lines.push(`${index + 1}. ${step}`);
    });
    return cleanDisplayText(lines.join('\n'));
  }

  if (payload.guidance && payload.is_safe !== undefined) {
    const lines = ['Dietary Guidance:', ''];
    lines.push(
      payload.is_safe
        ? 'This meal appears generally safe for your listed allergens.'
        : 'This meal may contain allergens you should avoid.'
    );

    if (payload.matched_allergens?.length) {
      lines.push('', 'Matched allergens:', payload.matched_allergens.join(', '));
    }

    if (payload.guidance?.length) {
      lines.push('', 'Suggestions:');
      payload.guidance.forEach((tip: string) => lines.push(`- ${tip}`));
    }

    if (payload.nutrition_tips?.length) {
      lines.push('', 'Nutrition tips:');
      payload.nutrition_tips.forEach((tip: string) => lines.push(`- ${tip}`));
    }

    return cleanDisplayText(lines.join('\n'));
  }

  if (payload.suggested_questions) {
    const lines = ['Restaurant Safety Tips:', ''];
    if (payload.cuisine) {
      lines.push(`Cuisine: ${titleCasePhrase(String(payload.cuisine))}`, '');
    }
    if (payload.known_allergens?.length) {
      lines.push('Your allergens to mention:', payload.known_allergens.join(', '), '');
    }
    if (payload.safer_picks?.length) {
      lines.push('Safer menu choices:');
      payload.safer_picks.forEach((item: string) => lines.push(`- ${item}`));
      lines.push('');
    }
    lines.push('Questions to ask staff:');
    payload.suggested_questions.forEach((item: string) => lines.push(`- ${item}`));
    return cleanDisplayText(lines.join('\n'));
  }

  if (payload.card_text) {
    return cleanDisplayText(['Travel Allergy Card:', '', payload.card_text].join('\n'));
  }

  if (Array.isArray(payload.insights)) {
    const lines = ['Symptom Insights:', ''];
    payload.insights.forEach((item: string) => lines.push(`- ${item}`));
    if (payload.message) {
      lines.push('', payload.message);
    }
    return cleanDisplayText(lines.join('\n'));
  }

  return cleanDisplayText(JSON.stringify(payload, null, 2));
}

export function formatCrossAllergenSummary(items: any[], aiSummary?: string): string {
  const lines = ['Cross-Allergen Summary:', ''];

  items.forEach((item, index) => {
    const foods = (item.cross_reactive || [])
      .filter((food: string) => food && food.toLowerCase() !== 'nan')
      .slice(0, 6);
    lines.push(`${index + 1}. ${item.primary || 'Unknown allergen'}`);
    lines.push(`   Risk level: ${item.risk || 'Unknown'}`);
    lines.push(`   Foods to watch: ${foods.length > 0 ? foods.join(', ') : 'None listed'}`);
    if (item.notes) {
      lines.push(`   Note: ${item.notes}`);
    }
    lines.push('');
  });

  if (aiSummary) {
    lines.push('What this means for you:', '', aiSummary);
  }

  return cleanDisplayText(lines.join('\n'));
}
