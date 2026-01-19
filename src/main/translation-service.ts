/**
 * Translation Service with automatic fallback strategy
 * Google Translate (优先) -> Bing Translate (备选) -> Failed
 */

import { translate as googleTranslate } from 'google-translate-api-x';
import { translate as bingTranslate } from 'bing-translate-api';

/**
 * Smart translation function with automatic source fallback
 * Strategy: Google (primary) -> Bing (fallback) -> Return error message
 * 
 * @param text - Text to translate
 * @param targetLang - Target language code (default: 'zh-CN')
 * @returns Translated text or error message
 */
export async function smartTranslate(
  text: string,
  targetLang: string = 'zh-CN'
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return "";
  }

  // 1. Try Google Translate (Primary)
  try {
    console.log(`🌐 Translating via Google: "${text.substring(0, 50)}..."`);
    
    // rejectOnPartialFail: false prevents partial failure from throwing
    const res = await googleTranslate(text, { 
      to: targetLang, 
      rejectOnPartialFail: false 
    });
    
    console.log(`✅ Google translation success`);
    return res.text;
    
  } catch (googleErr: any) {
    console.warn(`⚠️ Google Translate failed, trying Bing fallback... (${googleErr.message})`);
  }

  // 2. Try Bing Translate (Fallback - 国内可用性较高)
  try {
    console.log(`🌐 Translating via Bing (fallback): "${text.substring(0, 50)}..."`);
    
    // bing-translate-api signature: translate(text, from, to)
    // from = null means auto-detect
    // Convert zh-CN to zh-Hans for Bing
    const targetCode = targetLang === 'zh-CN' ? 'zh-Hans' : targetLang;
    
    const res: any = await bingTranslate(text, null, targetCode);
    
    // Handle different return structures
    if (res && res.translation) {
      console.log(`✅ Bing translation success`);
      return res.translation;
    }
    
    console.warn("⚠️ Bing returned unexpected format:", res);
    return "[翻译格式异常]";
    
  } catch (bingErr: any) {
    console.error(`❌ Bing Translate also failed: ${bingErr.message}`);
    return "[翻译失败: 网络不可达]";
  }
}
