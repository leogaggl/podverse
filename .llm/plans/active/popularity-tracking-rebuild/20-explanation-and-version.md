# 20 — Explanation and version

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Replace the Popularity Tracking explanation so it describes the design in
[00-REQUEST.md](00-REQUEST.md), and move the explanation version from `2026-10-15` to
`2026-10-21`. That version change is what asks again the listeners who already said yes
(R49). A no is not asked again. The mechanism already lives in
`packages/helpers/src/lib/popularityTracking.ts` (`isPopularityTrackingAllowed`,
`isPopularityTrackingPromptRequired`). Do not change that helper.

Transcribe the locale text below. Do not rewrite it, and do not add sentences.

## Rows

R32, R49

## Runs after

none

## Locked choices

- Version id is `2026-10-21`. Do not pick another date.
- Do not change `TERMS_OF_SERVICE_VERSION` or `NEXT_PUBLIC_TERMS_OF_SERVICE_VERSION`.
- Do not change `STATS_TRACK_EVENT_RETENTION_DAYS` or
  `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS`. The explanation keeps `{retention_days}`.
  Area D sets that number to 90.
- Do not edit `apps/api/src/config/index.ts`, `apps/api/src/lib/startup/validation.ts`, or
  `apps/api/openapi.yml`. The version is already read from the env var.
- Do not edit `apps/api/src/lib/legal/popularityTrackingContent.ts`. It already replaces
  `{brand_name}` and `{retention_days}`. Add no new placeholder.
- Do not edit the terms files. Plan 21 owns them.
- Do not edit `misc/aicasts/listener-privacy-1-popularity-tracking.md`.
- Do not edit gitignored `.env` files (`apps/api/.env`, `apps/web/sidecar/.env`).
- Do not edit `packages/helpers/src/lib/popularityTracking.test.ts` or
  `apps/mobile/src/terms/accountConsentPhase.test.ts`. The date in those files is a paired
  fixture, not the server id.
- Do not edit `apps/web/e2e/popularity-tracking-consent.spec.ts` or the Maestro flows. They
  still match: the intro still contains `Popularity Tracking is optional`, the body still has
  a heading `What We Store`, and Maestro taps test ids.
- Copy never calls the listener id anonymous or anonymized. The one allowed phrase is
  `This is not anonymous` (and the same disclaimer in each translation below).
- Do not name a rate limit, a half-life, a formula, a table, or a recommendation screen.
  Recommendations are mentioned only as the words below already do.
- The daily limit has no number. Area C picks the number.
- Listen records are removed a month at a time, and a record can outlive `{retention_days}`
  until its month is removed. That is what area D's job must do.

## Voice

Plain language. The first block, before the first `#` heading, is what
`getCopyMarkdownIntro` in `packages/helpers/src/lib/copyMarkdown.ts` shows above the buttons.
English headings are title case. Sentences are sentence case. `{brand_name}` and
`{retention_days}` stay as those exact tokens. Do not write Podverse, `30`, or `90`.

Do not call this an agreement, a policy, or a consent form. Do not write "legal", "comply",
or "we are required".

Section names, written the same way every time they name the list:

| Locale | Taste list | Hidden list |
| --- | --- | --- |
| en-US | Taste Profile | Hidden From Taste Profile |
| es | Perfil de gustos | Oculto del perfil de gustos |
| fr | Profil de goûts | Masqué du profil de goûts |
| el-GR | Προφίλ γούστου | Κρυμμένο από το προφίλ γούστου |

## English

Overwrite `apps/api/legal/popularity-tracking/en-US.md` with:

````markdown
Popularity Tracking is optional. It is available with a Premium membership. It helps listeners find shows people are enjoying, and it helps creators see when their work is reaching people. It also keeps a Taste Profile so recommendations can reflect the shows you listen to.

If you turn it on, {brand_name} counts you as one listener. Your name is not part of that count. You can turn it off any time in Settings. Turning it off deletes your Taste Profile and your stored listen records. Counts already on the public lists stay.

# How a Listen Is Counted

A listen counts when you have heard 60 seconds, or 25% of the episode or track, whichever comes first. Each counted listen is its own record: the episode or track, the clip when you played a clip, and the show it belongs to. Hearing it again can count again. There is a daily limit on how many listens count.

On the website, two more things are recorded for the public lists only: opening someone else's profile, and opening a playlist. Those opens do not update your Taste Profile. Opening your own profile is not recorded. The mobile apps do not record those opens.

Listening while signed out is not counted. If Popularity Tracking is off, new listens are not recorded.

# What We Store

Each listen record has a random id for your account, which thing you played, how many seconds you heard, whether you finished it, and when. An open on the website records the id, what you opened, and when. A record does not include your name, your email, or your username. That id stays with your account. It is not shown on your public profile.

We can still connect the id back to your account. That is how turning this off, and deleting your account, applies to you. This is not anonymous. We do not give the id to anyone else.

# Your Taste Profile

Your Taste Profile is a row for each show you listen to: a podcast, an album, or an artist. Episodes and tracks are not their own rows. A listen to an episode, a track, or a clip updates the show it belongs to. The row keeps how many times you have listened, how many you finished, and when you first and last listened. It also keeps a picture of what you have been listening to lately and what you have listened to over a longer time.

You can see your Taste Profile in Settings. You can remove a show from it. That show moves to Hidden From Taste Profile, and its taste data is deleted. Later listens to a hidden show still count on the public lists, and they do not add the show back.

You can see Hidden From Taste Profile. Taking a show off that list asks you to choose: add it back to your Taste Profile, starting over, or only take it off the list. If you only take it off the list, a later listen can add it again.

Opening a profile or a playlist does not update your Taste Profile.

# What the Lists Show

The public lists show counts. They do not show who listened. Those counts are not tied to your account.

# What We Do Not Do

- We do not sell this information.
- We do not share your Taste Profile with anyone else.
- We do not use it to advertise to you.

# How Long We Keep It

Listen records are kept for {retention_days} days. We then delete a whole month of records at once, so a record can remain until its month is removed. Your Taste Profile is not on that schedule. It stays until you turn Popularity Tracking off or you delete your account.

Counts already added to the public lists stay after a record is deleted. Those counts are numbers, not a list of listeners.

Deleting your account deletes the random id, your listen records, your Taste Profile, and your Hidden From Taste Profile list. The public counts stay.

# Changing Your Mind

Turn this on or off in Settings. Turning it off asks you to confirm, because we then delete your Taste Profile, your Hidden From Taste Profile list, and your stored listen records right away. Counts already on the public lists stay. If you turn it on later, recommendations start from scratch.

If your membership ends, or if this explanation changes and you have not confirmed it yet, we stop new records and keep your Taste Profile paused. Your Hidden From Taste Profile list stays. Listen records already stored still age out on the schedule above. The Taste Profile starts updating again when tracking is on. We do not delete it in those cases.

If you turn it off, we will not ask again when this explanation changes. If you turn it on, and we later change what we record or how long we keep it, we will ask again. Until you say yes to that update, tracking stays off.
````

## Spanish

Overwrite `apps/api/legal/popularity-tracking/es.md` with:

````markdown
El seguimiento de popularidad es opcional. Está disponible con una membresía Premium. Ayuda a los oyentes a encontrar programas que la gente está disfrutando, y ayuda a los creadores a ver cuándo su trabajo llega a las personas. También guarda un Perfil de gustos para que las recomendaciones puedan reflejar los programas que escuchas.

Si lo activas, {brand_name} te cuenta como un oyente. Tu nombre no forma parte de ese recuento. Puedes desactivarlo en cualquier momento en Configuraciones. Desactivarlo elimina tu Perfil de gustos y tus registros de escucha guardados. Los recuentos que ya están en las listas públicas permanecen.

# Cómo se cuenta una escucha

Una escucha cuenta cuando has oído 60 segundos, o el 25% del episodio o de la pista, lo que ocurra primero. Cada escucha contada es su propio registro: el episodio o la pista, el clip cuando reprodujiste un clip, y el programa al que pertenece. Escucharlo otra vez puede contar otra vez. Hay un límite diario de cuántas escuchas cuentan.

En el sitio web se registran dos cosas más, solo para las listas públicas: abrir el perfil de otra persona y abrir una lista de reproducción. Esas aperturas no actualizan tu Perfil de gustos. Abrir tu propio perfil no se registra. Las aplicaciones móviles no registran esas aperturas.

Escuchar sin haber iniciado sesión no se cuenta. Si el seguimiento de popularidad está desactivado, las escuchas nuevas no se registran.

# Qué guardamos

Cada registro de escucha tiene un id aleatorio de tu cuenta, qué reprodujiste, cuántos segundos oíste, si lo terminaste y cuándo. Una apertura en el sitio web registra el id, qué abriste y cuándo. Un registro no incluye tu nombre, tu correo electrónico ni tu nombre de usuario. Ese id permanece con tu cuenta. No se muestra en tu perfil público.

Aun así podemos conectar el id con tu cuenta. Así es como desactivar esto, y eliminar tu cuenta, se aplica a ti. Esto no es anónimo. No damos el id a nadie más.

# Tu Perfil de gustos

Tu Perfil de gustos es una fila por cada programa que escuchas: un pódcast, un álbum o un artista. Los episodios y las pistas no tienen su propia fila. Una escucha de un episodio, una pista o un clip actualiza el programa al que pertenece. La fila guarda cuántas veces has escuchado, cuántas terminaste, y cuándo escuchaste por primera y por última vez. También guarda una imagen de lo que has estado escuchando últimamente y de lo que has escuchado durante más tiempo.

Puedes ver tu Perfil de gustos en Configuraciones. Puedes quitar un programa. Ese programa pasa a Oculto del perfil de gustos, y sus datos de gustos se eliminan. Las escuchas posteriores de un programa oculto siguen contando en las listas públicas, y no vuelven a añadir el programa.

Puedes ver Oculto del perfil de gustos. Quitar un programa de esa lista te pregunta qué quieres: volver a añadirlo a tu Perfil de gustos, empezando de cero, o solo quitarlo de la lista. Si solo lo quitas de la lista, una escucha posterior puede añadirlo de nuevo.

Abrir un perfil o una lista de reproducción no actualiza tu Perfil de gustos.

# Qué muestran las listas

Las listas públicas muestran recuentos. No muestran quién escuchó. Esos recuentos no están ligados a tu cuenta.

# Qué no hacemos

- No vendemos esta información.
- No compartimos tu Perfil de gustos con nadie más.
- No la usamos para hacerte publicidad.

# Cuánto tiempo lo conservamos

Los registros de escucha se conservan durante {retention_days} días. Después eliminamos un mes entero de registros de una vez, así que un registro puede permanecer hasta que se elimine su mes. Tu Perfil de gustos no sigue ese calendario. Permanece hasta que desactives el seguimiento de popularidad o elimines tu cuenta.

Los recuentos ya añadidos a las listas públicas permanecen después de que se elimine un registro. Esos recuentos son números, no una lista de oyentes.

Eliminar tu cuenta elimina el id aleatorio, tus registros de escucha, tu Perfil de gustos y tu lista Oculto del perfil de gustos. Los recuentos públicos permanecen.

# Si cambias de opinión

Actívalo o desactívalo en Configuraciones. Desactivarlo te pide confirmación, porque entonces eliminamos de inmediato tu Perfil de gustos, tu lista Oculto del perfil de gustos y tus registros de escucha guardados. Los recuentos que ya están en las listas públicas permanecen. Si lo activas más adelante, las recomendaciones empiezan de cero.

Si tu membresía termina, o si esta explicación cambia y aún no la has confirmado, dejamos de crear registros nuevos y mantenemos tu Perfil de gustos en pausa. Tu lista Oculto del perfil de gustos permanece. Los registros de escucha ya guardados siguen caducando según el calendario de arriba. El Perfil de gustos vuelve a actualizarse cuando el seguimiento está activado. No lo eliminamos en esos casos.

Si lo desactivas, no volveremos a preguntar cuando cambie esta explicación. Si lo activas, y más adelante cambiamos qué registramos o cuánto tiempo lo conservamos, volveremos a preguntar. Hasta que aceptes esa actualización, el seguimiento permanece desactivado.
````

## French

Overwrite `apps/api/legal/popularity-tracking/fr.md` with:

````markdown
Le suivi de popularité est optionnel. Il est disponible avec un abonnement Premium. Il aide les auditeurs à trouver des émissions que les gens apprécient, et il aide les créateurs à voir quand leur travail atteint des personnes. Il conserve aussi un Profil de goûts pour que les recommandations puissent refléter les émissions que vous écoutez.

Si vous l'activez, {brand_name} vous compte comme un auditeur. Votre nom ne fait pas partie de ce décompte. Vous pouvez le désactiver à tout moment dans Paramètres. Le désactiver supprime votre Profil de goûts et vos enregistrements d'écoute conservés. Les décomptes déjà présents sur les listes publiques restent.

# Comment une écoute est comptée

Une écoute compte lorsque vous avez entendu 60 secondes, ou 25 % de l'épisode ou de la piste, selon ce qui arrive en premier. Chaque écoute comptée est son propre enregistrement : l'épisode ou la piste, le clip lorsque vous avez écouté un clip, et l'émission à laquelle cela appartient. L'entendre à nouveau peut compter à nouveau. Il y a une limite quotidienne au nombre d'écoutes qui comptent.

Sur le site web, deux choses de plus sont enregistrées, uniquement pour les listes publiques : ouvrir le profil de quelqu'un d'autre, et ouvrir une playlist. Ces ouvertures ne mettent pas à jour votre Profil de goûts. Ouvrir votre propre profil n'est pas enregistré. Les applications mobiles n'enregistrent pas ces ouvertures.

L'écoute sans être connecté n'est pas comptée. Si le suivi de popularité est désactivé, les nouvelles écoutes ne sont pas enregistrées.

# Ce que nous enregistrons

Chaque enregistrement d'écoute a un id aléatoire pour votre compte, ce que vous avez écouté, combien de secondes vous avez entendues, si vous l'avez terminé, et quand. Une ouverture sur le site web enregistre l'id, ce que vous avez ouvert, et quand. Un enregistrement n'inclut pas votre nom, votre e-mail ni votre nom d'utilisateur. Cet id reste avec votre compte. Il n'est pas affiché sur votre profil public.

Nous pouvons tout de même relier l'id à votre compte. C'est ainsi que désactiver ceci, et supprimer votre compte, s'applique à vous. Ceci n'est pas anonyme. Nous ne donnons l'id à personne d'autre.

# Votre Profil de goûts

Votre Profil de goûts est une ligne pour chaque émission que vous écoutez : un podcast, un album ou un artiste. Les épisodes et les pistes n'ont pas leur propre ligne. Une écoute d'un épisode, d'une piste ou d'un clip met à jour l'émission à laquelle cela appartient. La ligne conserve combien de fois vous avez écouté, combien vous avez terminées, et quand vous avez écouté pour la première et la dernière fois. Elle conserve aussi une image de ce que vous avez écouté dernièrement et de ce que vous avez écouté sur une plus longue durée.

Vous pouvez voir votre Profil de goûts dans Paramètres. Vous pouvez retirer une émission. Cette émission passe dans Masqué du profil de goûts, et ses données de goût sont supprimées. Les écoutes ultérieures d'une émission masquée comptent encore sur les listes publiques, et elles ne rajoutent pas l'émission.

Vous pouvez voir Masqué du profil de goûts. Retirer une émission de cette liste vous demande de choisir : la remettre dans votre Profil de goûts, en repartant de zéro, ou seulement la retirer de la liste. Si vous la retirez seulement de la liste, une écoute ultérieure peut l'ajouter de nouveau.

Ouvrir un profil ou une playlist ne met pas à jour votre Profil de goûts.

# Ce que les listes affichent

Les listes publiques affichent des décomptes. Elles ne montrent pas qui a écouté. Ces décomptes ne sont pas liés à votre compte.

# Ce que nous ne faisons pas

- Nous ne vendons pas ces informations.
- Nous ne partageons votre Profil de goûts avec personne d'autre.
- Nous ne les utilisons pas pour vous adresser de la publicité.

# Combien de temps nous le conservons

Les enregistrements d'écoute sont conservés pendant {retention_days} jours. Nous supprimons ensuite un mois entier d'enregistrements d'un coup, de sorte qu'un enregistrement peut rester jusqu'à ce que son mois soit supprimé. Votre Profil de goûts ne suit pas ce calendrier. Il reste jusqu'à ce que vous désactiviez le suivi de popularité ou que vous supprimiez votre compte.

Les décomptes déjà ajoutés aux listes publiques restent après la suppression d'un enregistrement. Ces décomptes sont des nombres, pas une liste d'auditeurs.

Supprimer votre compte supprime l'id aléatoire, vos enregistrements d'écoute, votre Profil de goûts et votre liste Masqué du profil de goûts. Les décomptes publics restent.

# Si vous changez d'avis

Activez ou désactivez ceci dans Paramètres. Le désactiver vous demande de confirmer, parce que nous supprimons alors tout de suite votre Profil de goûts, votre liste Masqué du profil de goûts et vos enregistrements d'écoute conservés. Les décomptes déjà présents sur les listes publiques restent. Si vous l'activez plus tard, les recommandations repartent de zéro.

Si votre abonnement se termine, ou si cette explication change et que vous ne l'avez pas encore confirmée, nous arrêtons les nouveaux enregistrements et nous gardons votre Profil de goûts en pause. Votre liste Masqué du profil de goûts reste. Les enregistrements d'écoute déjà conservés continuent d'expirer selon le calendrier ci-dessus. Le Profil de goûts recommence à se mettre à jour lorsque le suivi est activé. Nous ne le supprimons pas dans ces cas.

Si vous le désactivez, nous ne demanderons plus lorsque cette explication change. Si vous l'activez, et que nous changeons plus tard ce que nous enregistrons ou combien de temps nous le conservons, nous demanderons à nouveau. Tant que vous n'avez pas dit oui à cette mise à jour, le suivi reste désactivé.
````

## Greek

Overwrite `apps/api/legal/popularity-tracking/el-GR.md` with:

````markdown
Η παρακολούθηση δημοτικότητας είναι προαιρετική. Είναι διαθέσιμη με συνδρομή Premium. Βοηθά τους ακροατές να βρίσκουν εκπομπές που απολαμβάνει ο κόσμος, και βοηθά τους δημιουργούς να βλέπουν πότε η δουλειά τους φτάνει σε ανθρώπους. Κρατά επίσης ένα Προφίλ γούστου, ώστε οι προτάσεις να μπορούν να αντικατοπτρίζουν τις εκπομπές που ακούτε.

Αν την ενεργοποιήσετε, το {brand_name} σας μετρά ως έναν ακροατή. Το όνομά σας δεν είναι μέρος αυτής της μέτρησης. Μπορείτε να την απενεργοποιήσετε οποιαδήποτε στιγμή στις Ρυθμίσεις. Η απενεργοποίηση διαγράφει το Προφίλ γούστου σας και τις αποθηκευμένες εγγραφές ακρόασης. Οι μετρήσεις που βρίσκονται ήδη στις δημόσιες λίστες μένουν.

# Πώς μετράται μια ακρόαση

Μια ακρόαση μετρά όταν έχετε ακούσει 60 δευτερόλεπτα, ή το 25% του επεισοδίου ή του τραγουδιού, όποιο έρθει πρώτο. Κάθε ακρόαση που μετρά είναι η δική της εγγραφή: το επεισόδιο ή το τραγούδι, το απόσπασμα όταν αναπαράξατε ένα απόσπασμα, και η εκπομπή στην οποία ανήκει. Αν το ακούσετε ξανά, μπορεί να μετρήσει ξανά. Υπάρχει ημερήσιο όριο στο πόσες ακροάσεις μετρούν.

Στον ιστότοπο καταγράφονται δύο ακόμη πράγματα, μόνο για τις δημόσιες λίστες: το άνοιγμα του προφίλ κάποιου άλλου και το άνοιγμα μιας λίστας αναπαραγωγής. Αυτά τα ανοίγματα δεν ενημερώνουν το Προφίλ γούστου σας. Το άνοιγμα του δικού σας προφίλ δεν καταγράφεται. Οι εφαρμογές για κινητά δεν καταγράφουν αυτά τα ανοίγματα.

Η ακρόαση χωρίς να έχετε συνδεθεί δεν μετράται. Αν η παρακολούθηση δημοτικότητας είναι απενεργοποιημένη, οι νέες ακροάσεις δεν καταγράφονται.

# Τι αποθηκεύουμε

Κάθε εγγραφή ακρόασης έχει ένα τυχαίο id για τον λογαριασμό σας, τι αναπαράγατε, πόσα δευτερόλεπτα ακούσατε, αν το τελειώσατε, και πότε. Ένα άνοιγμα στον ιστότοπο καταγράφει το id, τι ανοίξατε, και πότε. Μια εγγραφή δεν περιλαμβάνει το όνομά σας, το email σας ή το όνομα χρήστη σας. Αυτό το id μένει με τον λογαριασμό σας. Δεν εμφανίζεται στο δημόσιο προφίλ σας.

Μπορούμε ακόμη να συνδέσουμε το id με τον λογαριασμό σας. Έτσι η απενεργοποίηση, και η διαγραφή του λογαριασμού σας, ισχύουν για εσάς. Αυτό δεν είναι ανώνυμο. Δεν δίνουμε το id σε κανέναν άλλον.

# Το Προφίλ γούστου σας

Το Προφίλ γούστου σας είναι μια γραμμή για κάθε εκπομπή που ακούτε: ένα podcast, ένα άλμπουμ ή έναν καλλιτέχνη. Τα επεισόδια και τα τραγούδια δεν έχουν δική τους γραμμή. Μια ακρόαση ενός επεισοδίου, ενός τραγουδιού ή ενός αποσπάσματος ενημερώνει την εκπομπή στην οποία ανήκει. Η γραμμή κρατά πόσες φορές έχετε ακούσει, πόσες τελειώσατε, και πότε ακούσατε για πρώτη και για τελευταία φορά. Κρατά επίσης μια εικόνα του τι ακούτε τελευταία και του τι έχετε ακούσει σε μεγαλύτερο διάστημα.

Μπορείτε να δείτε το Προφίλ γούστου σας στις Ρυθμίσεις. Μπορείτε να αφαιρέσετε μια εκπομπή. Αυτή η εκπομπή πηγαίνει στο Κρυμμένο από το προφίλ γούστου, και τα δεδομένα γούστου της διαγράφονται. Οι μεταγενέστερες ακροάσεις μιας κρυμμένης εκπομπής εξακολουθούν να μετρούν στις δημόσιες λίστες, και δεν προσθέτουν ξανά την εκπομπή.

Μπορείτε να δείτε το Κρυμμένο από το προφίλ γούστου. Η αφαίρεση μιας εκπομπής από αυτή τη λίστα σας ρωτά τι θέλετε: να την προσθέσετε ξανά στο Προφίλ γούστου σας, ξεκινώντας από την αρχή, ή μόνο να την αφαιρέσετε από τη λίστα. Αν την αφαιρέσετε μόνο από τη λίστα, μια μεταγενέστερη ακρόαση μπορεί να την προσθέσει ξανά.

Το άνοιγμα ενός προφίλ ή μιας λίστας αναπαραγωγής δεν ενημερώνει το Προφίλ γούστου σας.

# Τι δείχνουν οι λίστες

Οι δημόσιες λίστες δείχνουν μετρήσεις. Δεν δείχνουν ποιος άκουσε. Αυτές οι μετρήσεις δεν συνδέονται με τον λογαριασμό σας.

# Τι δεν κάνουμε

- Δεν πουλάμε αυτές τις πληροφορίες.
- Δεν μοιραζόμαστε το Προφίλ γούστου σας με κανέναν άλλον.
- Δεν τις χρησιμοποιούμε για να σας διαφημίσουμε.

# Πόσο καιρό το κρατάμε

Οι εγγραφές ακρόασης κρατιούνται για {retention_days} ημέρες. Έπειτα διαγράφουμε έναν ολόκληρο μήνα εγγραφών μονομιάς, ώστε μια εγγραφή να μπορεί να μείνει μέχρι να αφαιρεθεί ο μήνας της. Το Προφίλ γούστου σας δεν ακολουθεί αυτό το χρονοδιάγραμμα. Μένει μέχρι να απενεργοποιήσετε την παρακολούθηση δημοτικότητας ή να διαγράψετε τον λογαριασμό σας.

Οι μετρήσεις που έχουν ήδη προστεθεί στις δημόσιες λίστες μένουν μετά τη διαγραφή μιας εγγραφής. Αυτές οι μετρήσεις είναι αριθμοί, όχι μια λίστα ακροατών.

Η διαγραφή του λογαριασμού σας διαγράφει το τυχαίο id, τις εγγραφές ακρόασης, το Προφίλ γούστου σας και τη λίστα Κρυμμένο από το προφίλ γούστου. Οι δημόσιες μετρήσεις μένουν.

# Αν αλλάξετε γνώμη

Ενεργοποιήστε ή απενεργοποιήστε το στις Ρυθμίσεις. Η απενεργοποίηση σας ζητά επιβεβαίωση, γιατί τότε διαγράφουμε αμέσως το Προφίλ γούστου σας, τη λίστα Κρυμμένο από το προφίλ γούστου και τις αποθηκευμένες εγγραφές ακρόασης. Οι μετρήσεις που βρίσκονται ήδη στις δημόσιες λίστες μένουν. Αν την ενεργοποιήσετε αργότερα, οι προτάσεις ξεκινούν από την αρχή.

Αν η συνδρομή σας τελειώσει, ή αν αυτή η εξήγηση αλλάξει και δεν την έχετε επιβεβαιώσει ακόμη, σταματάμε τις νέες εγγραφές και κρατάμε το Προφίλ γούστου σας σε παύση. Η λίστα Κρυμμένο από το προφίλ γούστου μένει. Οι εγγραφές ακρόασης που έχουν ήδη αποθηκευτεί συνεχίζουν να λήγουν σύμφωνα με το χρονοδιάγραμμα παραπάνω. Το Προφίλ γούστου αρχίζει να ενημερώνεται ξανά όταν η παρακολούθηση είναι ενεργή. Δεν το διαγράφουμε σε αυτές τις περιπτώσεις.

Αν το απενεργοποιήσετε, δεν θα ρωτήσουμε ξανά όταν αλλάξει αυτή η εξήγηση. Αν το ενεργοποιήσετε, και αργότερα αλλάξουμε τι καταγράφουμε ή πόσο καιρό το κρατάμε, θα ρωτήσουμε ξανά. Μέχρι να πείτε ναι σε αυτή την ενημέρωση, η παρακολούθηση μένει απενεργοποιημένη.
````

## Version id

Set `POPULARITY_TRACKING_AGREEMENT_VERSION` and
`NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` to `2026-10-21`.

K8s `source/*.env` values stay unquoted. Node env files keep double quotes. Change only the
popularity version key and, where noted, the comment on that key. Leave every other key.

On these files, replace the comment that says the id is shown as the agreement date. The
explanation does not display the id. New comment, one key per comment line:

`# Date-shaped id. A new value re-prompts accounts that already accepted. The explanation does not display this id.`

- `infra/k8s/base/api/source/api.env` — unquoted `POPULARITY_TRACKING_AGREEMENT_VERSION=2026-10-21`, and replace the comment on that key.
- `apps/api/.env.example` — quoted value, and replace the two comment lines above that key with the new comment.
- `apps/api/ENV.md` — in the `POPULARITY_TRACKING_AGREEMENT_VERSION` bullet, use `2026-10-21` as the example and delete the sentence that says the value is shown as the agreement date. Say the explanation does not display the id. Leave the `TERMS_OF_SERVICE_VERSION` bullet on `2026-10-15`.
- `dev/env-overrides/local/legal.env.example` — quoted value, and replace the two comment lines above that key with the new comment.
- `dev/env-overrides/local/legal.env` — quoted value only. Do not change `LEGAL_NAME`, `LEGAL_ADDRESS`, or `TERMS_OF_SERVICE_VERSION`.

Value only, no comment edit:

- `infra/k8s/base/web/source/web-sidecar.env` — unquoted `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION=2026-10-21`. Leave `NEXT_PUBLIC_TERMS_OF_SERVICE_VERSION` and `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS`.
- `apps/web/sidecar/.env.example` — quoted `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION`. Leave the "Mirrors API" comment and the terms version.
- `packages/helpers-config/src/podverseTestEnv.ts` — `POPULARITY_TRACKING_AGREEMENT_VERSION` only. Leave `TERMS_OF_SERVICE_VERSION` and `STATS_TRACK_EVENT_RETENTION_DAYS`.
- `apps/web/playwright.e2e-server-env.ts` — `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` only. Leave `E2E_TERMS_OF_SERVICE_VERSION`.
- `tools/web/seed-e2e.mjs` — the constant `E2E_POPULARITY_TRACKING_VERSION` only. Leave `E2E_CONFIGURED_TERMS_VERSION`. Seeded accepts must match the server id, or the already-accepted E2E account is asked again.

## Files

- `apps/api/legal/popularity-tracking/en-US.md`
- `apps/api/legal/popularity-tracking/es.md`
- `apps/api/legal/popularity-tracking/fr.md`
- `apps/api/legal/popularity-tracking/el-GR.md`
- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/web/source/web-sidecar.env`
- `apps/api/.env.example`
- `apps/api/ENV.md`
- `apps/web/sidecar/.env.example`
- `dev/env-overrides/local/legal.env`
- `dev/env-overrides/local/legal.env.example`
- `packages/helpers-config/src/podverseTestEnv.ts`
- `apps/web/playwright.e2e-server-env.ts`
- `tools/web/seed-e2e.mjs`
- `apps/api/src/test/legal-popularity-tracking.test.ts`
- `apps/api/src/test/account-settings.test.ts`

## Tests

`apps/api/src/test/legal-popularity-tracking.test.ts` loads `GET /legal/popularity-tracking`.

- The English case expects `res.body.version` to be `2026-10-21`. It still expects the markdown to contain `Popularity Tracking is optional` and `not anonymous`. Also expect `Taste Profile` and `Hidden From Taste Profile`.
- The Spanish case still expects `El seguimiento de popularidad es opcional` and `no es anónimo`. Also expect `Perfil de gustos`.
- Add a French case on the same locale mock, expecting `Le suivi de popularité est optionnel` and `Profil de goûts`.
- Add a Greek case on the same locale mock, expecting `Η παρακολούθηση δημοτικότητας είναι προαιρετική` and `Προφίλ γούστου`.

`apps/api/src/test/account-settings.test.ts`, describe `PATCH /account-settings/listen-stats`: the controller stamps `config.popularityTracking.version`. Change `agreement_version` and `listen_stats_agreement_version` from `2026-10-15` to `2026-10-21`, including the default mock return. Do not change `listen_stats_decided_at`.

Do not snapshot the markdown. Do not edit `packages/helpers/src/lib/copyMarkdown.test.ts`.

Before finishing, search the four explanation files for `anonymized`, `anonimizado`, `anonymisé`, and `ανωνυμοποιη`. None of those may appear.

Do not run tests in this turn.

## Release scratchpad

```markdown
## Popularity Tracking explanation asks again

- Surfaces: api, web, mobile
- Change: The Popularity Tracking explanation now describes listen records kept on a monthly schedule, a Taste Profile kept until the listener turns tracking off, a Hidden From Taste Profile list, immediate deletion of that personal data when they confirm turning it off, and a paused Taste Profile when a membership ends or a new explanation is waiting. Public counts stay. `POPULARITY_TRACKING_AGREEMENT_VERSION` moves from `2026-10-15` to `2026-10-21`, so a listener who had turned tracking on is asked again and tracking stays off until they say yes. A listener who said no is not asked again. The terms version does not change.
- Who notices: Premium listeners who already turned Popularity Tracking on
- Operator steps: set `POPULARITY_TRACKING_AGREEMENT_VERSION` and `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` to `2026-10-21` on the API and the web sidecar. For a local checkout, the version in `dev/env-overrides/local/legal.env` is already updated; run `make local_env_setup` from the repo root so generated env files pick it up. Do not change `TERMS_OF_SERVICE_VERSION`.
```
