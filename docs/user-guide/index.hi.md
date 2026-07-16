<div class="guide-wordmark" align="center" markdown>

![GPT-Voice वर्डमार्क](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width='620' }

</div>

# GPT-Voice डॉक्यूमेंटेशन

GPT-Voice एक डेस्कटॉप वॉयस-टू-टेक्स्ट एप्लिकेशन है। एक वैश्विक शॉर्टकट के साथ एक विचार रिकॉर्ड करें, एक के माध्यम से ऑडियो भेजें
प्रदाता जिसे आप नियंत्रित करते हैं, और अपने क्लिपबोर्ड पर प्रतिलेखन प्राप्त करते हैं।

<div class="guide-links" markdown>

[GPT-Voice होम](/gpt-voice/) <span aria-hidden="true">·</span>
[रिपॉजिटरी](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[नवीनतम रिलीज़](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: डाउनलोड GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-बटन .md-बटन--प्राथमिक }
[:material-rocket-launch: आरंभ करें](getting-started.md){ .md-बटन }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  GPT-Voice.</figcaption> में <figcaption>A रेडी-टू-रिकॉर्ड कमांड डॉक
</figure>

<aside class="release-note">
  यह मार्गदर्शिका नवीनतम जारी GPT-Voice संस्करण का दस्तावेजीकरण करती है। प्रदाता की उपलब्धता, सीमाएँ, बिलिंग और शर्तें बनी रहेंगी
  आपके द्वारा उपयोग किए जाने वाले प्रदाता खाते द्वारा नियंत्रित।
</aside>

## GPT-Voice क्या करता है

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  किसी रिकॉर्डिंग को ट्रांसक्राइब करने के लिए साइन-इन **ChatGPT Web** सत्र या आधिकारिक **OpenAI API** का उपयोग करें।

- :material-content-paste: **Keep the workflow on your desktop**

  कॉपी किए गए टेक्स्ट को रिकॉर्ड करें, रोकें और जहां आपको इसकी आवश्यकता हो वहां पेस्ट करें। सफल परिणाम क्लिपबोर्ड पर कॉपी किए जाते हैं;
  GPT-Voice उन्हें स्वचालित रूप से किसी अन्य एप्लिकेशन में सम्मिलित नहीं करता है।

- :material-translate: **Translate selected text**

  वैश्विक शॉर्टकट के साथ चयनित-पाठ अनुवाद क्रिया चलाएँ, फिर परिणाम को क्लिपबोर्ड से चिपकाएँ।

- :material-auto-fix: **Use Prettify**

  Ollama या vLLM सेवा जिसे आप कॉन्फ़िगर और चलाते हैं, के माध्यम से उसके अर्थ को संरक्षित करते हुए चयनित पाठ को साफ़ करें।

- :material-history: **Return to useful results**

  ऑडियो को दोबारा भेजे बिना कॉपी किए गए परिणाम पर लौटने के लिए वैश्विक शॉर्टकट और स्थानीय ट्रांसक्रिप्शन इतिहास का उपयोग करें।

</div>

## शुरू करने से पहले

GPT-Voice ने विंडोज़ और लिनक्स के लिए रिलीज़ पैकेज का समर्थन किया है। हस्ताक्षर करते समय वर्तमान macOS रिलीज़ को रोक दिया जाता है
नोटरीकरण तैयार किया जाता है। अपने प्लेटफ़ॉर्म के लिए पैकेज डाउनलोड करें
[GitHub ने पेज](https://github.com/swimmwatch/gpt-voice/releases) जारी किया।

प्रतिलेखन के लिए, एक प्रदाता चुनें:

- **ChatGPT Web** को एक साइन-इन ब्राउज़र सत्र की आवश्यकता है।
- **OpenAI API** को आपकी स्वयं की एपीआई कुंजी और उपलब्ध एपीआई बिलिंग या कोटा की आवश्यकता होती है।

प्रदाता की उपलब्धता, सीमाएं, बिलिंग और शर्तें आपके द्वारा उपयोग किए जाने वाले प्रदाता खाते द्वारा नियंत्रित की जाती हैं। GPT-Voice नहीं है
उन सीमाओं को दरकिनार करें.

## गाइड का दायरा

[इंस्टॉलेशन](install.md) से शुरू करें, फिर किसी प्रदाता से जुड़ने और पुष्टि करने के लिए [पहले ](getting-started.md) का उपयोग करें] का पालन करें
कि एक प्रतिलेखन आपके क्लिपबोर्ड तक पहुँच जाता है। [रिकॉर्डिंग और ट्रांसक्रिप्शन](guides/transcription.md), के साथ जारी रखें
[प्रदाता सेटअप](guides/providers.md), [सेटिंग्स](settings/index.md), [गोपनीयता और डेटा](privacy.md),
[समस्या निवारण](troubleshooting.md), और [अक्सर पूछे जाने वाले प्रश्न](faq.md)।

GPT-Voice एक स्वतंत्र परियोजना है और ओपनएआई, एंथ्रोपिक या गूगल से संबद्ध नहीं है। इसके अंतर्गत लाइसेंस प्राप्त है
[पॉलीफॉर्म गैर-वाणिज्यिक 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), जो एक नहीं है
ओएसआई-अनुमोदित ओपन-सोर्स लाइसेंस।
