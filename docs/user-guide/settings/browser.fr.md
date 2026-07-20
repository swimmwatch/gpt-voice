# Paramètres du navigateur

GPT-Voice utilise CloakBrowser pour les services basés sur un navigateur tels que ChatGPT Web et la traduction du texte sélectionné. Ouvrez **Settings** et sélectionnez **Browser** pour définir le comportement et les valeurs d'identité utilisées lorsque GPT-Voice crée ces contextes de navigateur. Configurez un proxy dans [Paramètres réseau](network.md).

## Comportement du navigateur

| Paramètre              | Par défaut  | Valeurs disponibles        | Effet                                                                                      |
| ---------------------- | ----------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| **Humanize input**     | Activé      | Activé ou désactivé        | Passe le paramètre d'entrée Humaniser à CloakBrowser.                                      |
| **Human preset**       | **Careful** | **Default** ou **Careful** | Choisit le préréglage d'humanisation CloakBrowser.                                         |
| **Background browser** | **Hidden**  | **Hidden** ou **Visible**  | Contrôle si le navigateur d'arrière-plan persistant de GPT-Voice est sans tête ou affiché. |

Le paramètre **Background browser** s'applique au navigateur en arrière-plan persistant. Une fenêtre de connexion ChatGPT Web est toujours visible afin que vous puissiez terminer l'authentification. Choisissez **Visible** lorsque vous devez observer le navigateur en arrière-plan ; sinon, laissez le mode par défaut **Hidden** sélectionné.

## Identité du navigateur

Ouvrez **Identity** pour afficher ou modifier les valeurs que GPT-Voice transmet à un contexte de navigateur.

| Paramètre            | Par défaut                                                            | Exigence et action                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fingerprint seed** | Valeur de départ numérique générée par GPT-Voice                      | Chiffres obligatoires uniquement. Choisissez **Reset** pour générer une nouvelle valeur de départ numérique à cinq chiffres.                                                                                                |
| **Locale**           | `en-US`                                                               | Sélectionnez l'un des paramètres régionaux du navigateur pris en charge : `en-US`, `en-GB`, `ru-RU`, `uk-UA`, `be-BY`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-BR`, `pl-PL`, `tr-TR`, `ja-JP`, `ko-KR`, `zh-CN` ou `zh-TW`. |
| **Timezone**         | Le fuseau horaire de votre système, ou `UTC` en cas d'indisponibilité | Sélectionnez un fuseau horaire IANA pris en charge.                                                                                                                                                                         | La graine d’empreinte digitale, les paramètres régionaux et le fuseau horaire sont requis. Les paramètres rejettent une valeur de départ contenant autre chose que des chiffres, des paramètres régionaux qui ne sont pas des paramètres régionaux BCP 47 valides ou un fuseau horaire qui n'est pas un fuseau horaire IANA valide. GPT-Voice supprime les espaces environnants lors de l'enregistrement de ces valeurs. |

### Proxy GeoIP contrôle les paramètres régionaux et le fuseau horaire

Lorsque le proxy est activé avec **GeoIP** dans [Paramètres réseau](network.md), le proxy détermine les paramètres régionaux et le fuseau horaire du navigateur. GPT-Voice désactive ces deux champs dans **Identity** et affiche le message **Proxy GeoIP controls locale and timezone**. Les paramètres régionaux et le fuseau horaire enregistrés restent disponibles si vous désactivez ultérieurement GeoIP, mais ils ne sont pas envoyés à un contexte de navigateur tant que le proxy actif GeoIP les possède.

## Enregistrer les modifications

Les paramètres du navigateur font partie du formulaire Paramètres. La modification d'une valeur crée **Unsaved changes** ; choisissez **Save changes** une fois la validation réussie. La configuration normale du navigateur est stockée dans les paramètres locaux de GPT-Voice et elle sera utilisée la prochaine fois que GPT-Voice créera le contexte de navigateur applicable. Consultez la [Présentation des paramètres](index.md) pour connaître les erreurs de sauvegarde et le comportement de confirmation de suppression.
