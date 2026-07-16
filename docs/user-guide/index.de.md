<div class="guide-wordmark" align="center" markdown>

![GPT-Voice Wortmarke](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# GPT-Voice Dokumentation

GPT-Voice ist eine Desktop-Voice-to-Text-Anwendung. Nehmen Sie einen Gedanken mit einer globalen Verknüpfung auf und senden Sie das Audio über eine
Sie erhalten einen von Ihnen kontrollierten Anbieter und erhalten die Transkription in Ihrer Zwischenablage.

<div class="guide-links" markdown>

[GPT-Voice Startseite](/gpt-voice/) <span aria-hidden="true">·</span>
[Repository](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Neueste Version](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Herunterladen GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Erste Schritte](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>Ein aufnahmebereites Command Dock in GPT-Voice.</figcaption>
</figure>

<aside class="release-note">
  Dieses Handbuch dokumentiert die neueste veröffentlichte Version GPT-Voice. Verfügbarkeit, Limits, Abrechnung und Bedingungen des Anbieters bleiben bestehen
  wird durch das von Ihnen verwendete Anbieterkonto gesteuert.
</aside>

## Was GPT-Voice macht

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  Verwenden Sie eine angemeldete **ChatGPT Web**-Sitzung oder die offizielle **OpenAI API**, um eine Aufnahme zu transkribieren.

- :material-content-paste: **Keep the workflow on your desktop**

  Zeichnen Sie den kopierten Text auf, stoppen Sie ihn und fügen Sie ihn dort ein, wo Sie ihn benötigen. Erfolgreiche Ergebnisse werden in die Zwischenablage kopiert;
  GPT-Voice fügt sie nicht automatisch in eine andere Anwendung ein.

- :material-translate: **Translate selected text**

  Führen Sie eine Übersetzungsaktion für ausgewählten Text mit einer globalen Verknüpfung aus und fügen Sie dann das Ergebnis aus der Zwischenablage ein.

- :material-auto-fix: **Use Prettify**

  Bereinigen Sie ausgewählten Text und bewahren Sie dabei seine Bedeutung mit einem Ollama- oder vLLM-Dienst, den Sie konfigurieren und ausführen.

- :material-history: **Return to useful results**

  Verwenden Sie globale Verknüpfungen und den lokalen Transkriptionsverlauf, um zu einem kopierten Ergebnis zurückzukehren, ohne das Audio erneut zu senden.

</div>

## Bevor Sie beginnen

GPT-Voice verfügt über unterstützte Release-Pakete für Windows und Linux. Aktuelle macOS-Versionen werden beim Signieren angehalten und
Beurkundung wird vorbereitet. Laden Sie das Paket für Ihre Plattform herunter
[GitHub-Releases-Seite](https://github.com/swimmwatch/gpt-voice/releases).

Wählen Sie für die Transkription einen Anbieter:

- **ChatGPT Web** erfordert eine angemeldete Browsersitzung.
- **OpenAI API** erfordert Ihren eigenen API-Schlüssel und verfügbare API-Abrechnung oder -Kontingent.

Verfügbarkeit, Limits, Abrechnung und Bedingungen des Anbieters werden durch das von Ihnen verwendete Anbieterkonto gesteuert. GPT-Voice nicht
diese Grenzen umgehen.

## Leitfernrohr

Beginnen Sie mit der [Installation](install.md) und folgen Sie dann der [ersten Verwendung](getting-started.md), um einen Anbieter zu verbinden und zu bestätigen
dass eine Transkription in Ihre Zwischenablage gelangt. Weiter mit [Aufnahme und Transkription](guides/transcription.md),
[Anbieter-Setup](guides/providers.md), [Einstellungen](settings/index.md), [Datenschutz und Daten](privacy.md),
[Fehlerbehebung](troubleshooting.md) und [häufig gestellte Fragen](faq.md).GPT-Voice ist ein unabhängiges Projekt und steht in keiner Verbindung zu OpenAI, Anthropic oder Google. Es ist lizenziert unter
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), was kein
OSI-genehmigte Open-Source-Lizenz.
