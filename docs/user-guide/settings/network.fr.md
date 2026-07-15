# Paramètres réseau

Ouvrez **Settings** et sélectionnez **Network** pour configurer les transmissions proxy GPT-Voice aux contextes CloakBrowser. Ces paramètres affectent les services basés sur le navigateur tels que ChatGPT Web et la traduction du texte sélectionné. Pour les paramètres d'identité affectés par le proxy GeoIP, voir [Paramètres du navigateur](browser.md).

## Activer un proxy

**Proxy enabled** est désactivé par défaut. Lorsqu'il est désactivé, GPT-Voice ne transmet pas de proxy à CloakBrowser et les champs réseau restants sont désactivés. Le désactiver n’efface pas les valeurs que vous avez saisies, vous pourrez donc réactiver le proxy plus tard.

Lorsque vous l'activez, **Proxy server** est requis. Saisissez une URL complète à l'aide de l'un de ces protocoles :

- `http://`
- `https://`
- `socks5://`

Par exemple, `http://proxy.example.com:8080` est un format de serveur valide. GPT-Voice supprime les espaces environnants lors de l'enregistrement de la valeur. Il rejette un serveur manquant ou mal formé, les protocoles non pris en charge et les URL contenant un nom d'utilisateur ou un mot de passe. Mettez plutôt les informations d’identification dans les champs séparés.

## Contournement et informations d'identification

| Champ        | Par défaut                | Comportement                                                                                                  |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Bypass**   | Vierge                    | Facultatif. Lorsqu'il est fourni, GPT-Voice transmet la valeur de contournement à CloakBrowser avec le proxy. |
| **Username** | Vierge                    | Nom d'utilisateur proxy facultatif pour l'authentification proxy HTTP ou HTTPS.                               |
| **Password** | Aucun mot de passe stocké | Mot de passe proxy facultatif pour l'authentification proxy HTTP ou HTTPS.                                    |

Le mot de passe est stocké séparément via Electron safe storage. Après l'enregistrement, sa valeur n'est pas renvoyée dans Paramètres ; le champ indique qu'un mot de passe est enregistré à la place. Laisser le champ vide conserve un mot de passe existant. Choisissez **Clear** pour le supprimer. Si le stockage sécurisé n'est pas disponible, GPT-Voice ne peut pas enregistrer un nouveau mot de passe proxy.

Ne placez pas de nom d'utilisateur ou de mot de passe dans l'URL du serveur proxy, ne collez pas les informations d'identification dans une demande d'assistance ou ne les exposez pas dans une capture d'écran.

### SOCKS5 les informations d'identification ne sont pas prises en charge

CloakBrowser ne prend pas en charge un nom d'utilisateur ou un mot de passe pour un proxy SOCKS5. Lorsqu'un proxy SOCKS5 activé possède l'un ou l'autre des informations d'identification, Paramètres affiche un avertissement et bloque l'enregistrement jusqu'à ce que vous supprimiez le nom d'utilisateur et effaciez le mot de passe. GPT-Voice ne transmet pas les informations d'identification SOCKS5 à CloakBrowser.

## Laisser le proxy GeoIP posséder l'identité du navigateur

**GeoIP** est désactivé par défaut et n'est disponible que lorsque le proxy est activé. Activez-le lorsque le proxy configuré doit déterminer les paramètres régionaux et le fuseau horaire du navigateur. Alors que le proxy et GeoIP sont actifs, GPT-Voice transmet le proxy avec GeoIP activé et ne transmet pas ses paramètres régionaux ou son fuseau horaire enregistrés séparément.Par conséquent, les champs **Locale** et **Timezone** dans [Paramètres du navigateur](browser.md) sont désactivés et affichent **Proxy GeoIP controls locale and timezone**. Désactivez GeoIP pour modifier et utiliser à nouveau les valeurs d'identité du navigateur enregistrées.

## Enregistrer et dépanner

Les valeurs du réseau font partie du formulaire Paramètres. Choisissez **Save changes** une fois la validation réussie ; la configuration du proxy enregistrée est utilisée la prochaine fois que GPT-Voice crée le contexte de navigateur applicable. Si l'enregistrement échoue, les paramètres restent ouverts et identifient le champ non valide.

En cas d'échec de connexion, vérifiez que l'URL du serveur inclut `http`, `https` ou `socks5`, que le proxy est accessible et que les informations d'identification HTTP/HTTPS se trouvent dans leurs champs dédiés. Ne saisissez pas les informations d'identification SOCKS5. Consultez la [Présentation des paramètres](index.md) pour connaître le comportement des modifications non enregistrées et des confirmations de suppression.
