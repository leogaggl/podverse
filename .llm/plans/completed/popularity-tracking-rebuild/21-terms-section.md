# 21 — Terms section

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Replace the Popularity Tracking section of the terms so the legal notice matches the
explanation in [20-explanation-and-version.md](20-explanation-and-version.md). The terms are
the legal notice. The explanation is not.

Transcribe the sections below. Do not rewrite them. Do not bump any version. Plan 20 owns
`POPULARITY_TRACKING_AGREEMENT_VERSION`.

## Rows

R32

## Runs after

none

## Locked choices

- Do not change `TERMS_OF_SERVICE_VERSION`, `NEXT_PUBLIC_TERMS_OF_SERVICE_VERSION`, or
  `POPULARITY_TRACKING_AGREEMENT_VERSION`. A terms-version change would block the app until
  every account accepts again. This section updates the notice. It does not ask again.
- Do not edit the popularity-tracking markdown, catalog keys, or `AgreementChoices`.
- Do not edit `apps/api/src/lib/legal/termsContent.ts`. `{retention_days}`, `{legal_name}`,
  `{contact_email}`, and `{legal_address}` are already replaced. When `{contact_email}` or
  `{legal_address}` is empty, lines that contain that placeholder are already dropped. Keep
  `{contact_email}` in the access sentence so that drop still applies.
- Do not hardcode Podverse, `30`, `90`, or a daily-limit number.
- Do not edit the Cloudflare analytics sentence or anything after it (cookie choices, the
  company block). That sentence is a different feature. It uses "anonymous" for Cloudflare
  analytics. Leave that word there.
- Copy never calls the listener id anonymous or anonymized. The disclaimer in each section
  below is the only new anonymity wording.
- Same product names as plan 20: Taste Profile, Hidden From Taste Profile, Perfil de gustos,
  Oculto del perfil de gustos, Profil de goûts, Masqué du profil de goûts, Προφίλ γούστου,
  Κρυμμένο από το προφίλ γούστου.
- Do not edit `overrides/` or `misc/aicasts/listener-privacy-1-popularity-tracking.md`.

## What to replace

In each terms file, replace the Popularity Tracking section from its heading through the
access-request paragraph (the one with `{contact_email}`). Leave the blank line and the
Cloudflare paragraph, and everything after them, byte for byte.

Anchors for the first line you must not change:

- `apps/api/legal/terms/en-US.md` — `Anonymous web analytics (Cloudflare)`
- `apps/api/legal/terms/es.md` — `La analítica web anónima (Cloudflare)`
- `apps/api/legal/terms/fr.md` — `L'analytique web anonyme (Cloudflare)`
- `apps/api/legal/terms/el-GR.md` — `Η ανώνυμη ανάλυση web (Cloudflare)`

## English

Replace `## Popularity Tracking` through the `{contact_email}` paragraph in
`apps/api/legal/terms/en-US.md` with:

````markdown
## Popularity Tracking

Popularity Tracking is an optional feature. It is available with a Premium membership. It stays off until you turn it on, and you can turn it off in account settings. Turning it off does not limit playback, your account, or a membership.

When it is on, {legal_name} records a listen once you have heard 60 seconds, or 25% of the episode or track, whichever comes first. Each counted listen is its own record. The record includes the episode or track, the clip when you played a clip, the show it belongs to, how many seconds you heard, whether you finished it, and the time. Hearing it again can count again. There is a daily limit on how many listens count. On the website, opening someone else's profile is recorded, and opening a playlist is recorded. Those opens count toward public lists only. They do not update your Taste Profile. Opening your own profile is not recorded. The mobile apps do not record those opens. Listening while signed out is not recorded this way.

Each record stores a random id for your account. The id stays with your account. It is not your name, your email, or your public username. {legal_name} can connect that id back to your account, so your choice and a deletion request apply to you. The record is not anonymous.

{legal_name} also keeps a Taste Profile: one row per show you listen to (a podcast, an album, or an artist). Episodes and tracks are not their own rows. A listen to an episode, a track, or a clip updates the show it belongs to. A row keeps how many times you have listened, how many you finished, when you first and last listened, and a picture of what you have been listening to lately and over a longer time. You can see this list in account settings. You can remove a show from it. The show then moves to Hidden From Taste Profile, and its taste data is deleted. Later listens to a hidden show still count on the public lists, and they do not add the show back. Taking a show off Hidden From Taste Profile asks you to add it back to your Taste Profile, starting over, or only to take it off that list. If you only take it off the list, a later listen can add it again. Opening a profile or a playlist does not update your Taste Profile.

The records and the Taste Profile are used to count listeners for discovery lists, so creators can see that their work is reaching people, and so recommendations can reflect shows you listen to. They are not sold, your Taste Profile is not shared with anyone else, and they are not used to advertise to you. Public lists show counts. They do not show who listened, and those counts are not tied to your account.

Listen records are kept for {retention_days} days. {legal_name} then deletes a whole month of records at once, so a record can remain until its month is removed. Your Taste Profile is not on that schedule. It stays until you turn Popularity Tracking off or you delete your account. Counts already published stay as numbers, without a list of who listened.

Turning Popularity Tracking off asks you to confirm. On confirm, {legal_name} deletes your Taste Profile, your Hidden From Taste Profile list, and your stored listen records right away. Public counts already published stay. If you turn it on later, recommendations start from scratch. If your membership ends, or if this explanation changes and you have not confirmed it yet, new records stop and your Taste Profile stays paused until tracking is on again. Your Hidden From Taste Profile list stays. Listen records already stored still age out on that schedule. The Taste Profile is not deleted in those cases. If you turn it off, {legal_name} will not ask again when the explanation changes. If you turn it on, and what is recorded or how long it is kept later changes, you will be asked again. Until you say yes, tracking stays off.

Deleting your account deletes the id, your listen records, your Taste Profile, and your Hidden From Taste Profile list. The public counts stay.

To ask for a copy, a correction, or deletion sooner than that, email {contact_email}. If we refuse, reply to that email and we will review the request again.
````

## Spanish

Replace `## Seguimiento de popularidad` through the `{contact_email}` paragraph in
`apps/api/legal/terms/es.md` with:

````markdown
## Seguimiento de popularidad

El seguimiento de popularidad es una función opcional. Está disponible con una membresía Premium. Permanece desactivado hasta que lo actives, y puedes desactivarlo en la configuración de la cuenta. Desactivarlo no limita la reproducción, tu cuenta ni una membresía.

Cuando está activado, {legal_name} registra una escucha una vez que has oído 60 segundos, o el 25% del episodio o de la pista, lo que ocurra primero. Cada escucha contada es su propio registro. El registro incluye el episodio o la pista, el clip cuando reprodujiste un clip, el programa al que pertenece, cuántos segundos oíste, si lo terminaste y la hora. Escucharlo otra vez puede contar otra vez. Hay un límite diario de cuántas escuchas cuentan. En el sitio web se registra abrir el perfil de otra persona, y se registra abrir una lista de reproducción. Esas aperturas cuentan solo para las listas públicas. No actualizan tu Perfil de gustos. Abrir tu propio perfil no se registra. Las aplicaciones móviles no registran esas aperturas. Escuchar sin haber iniciado sesión no se registra de esta manera.

Cada registro guarda un identificador aleatorio de tu cuenta. El identificador permanece con tu cuenta. No es tu nombre, tu correo ni tu nombre de usuario público. {legal_name} puede relacionar ese identificador con tu cuenta, para que tu elección y una solicitud de eliminación se apliquen a ti. El registro no es anónimo.

{legal_name} también guarda un Perfil de gustos: una fila por cada programa que escuchas (un pódcast, un álbum o un artista). Los episodios y las pistas no tienen su propia fila. Una escucha de un episodio, una pista o un clip actualiza el programa al que pertenece. Una fila guarda cuántas veces has escuchado, cuántas terminaste, cuándo escuchaste por primera y por última vez, y una imagen de lo que has estado escuchando últimamente y de lo que has escuchado durante más tiempo. Puedes ver esta lista en la configuración de la cuenta. Puedes quitar un programa. El programa pasa entonces a Oculto del perfil de gustos, y sus datos de gustos se eliminan. Las escuchas posteriores de un programa oculto siguen contando en las listas públicas, y no vuelven a añadir el programa. Quitar un programa de Oculto del perfil de gustos te pregunta si quieres volver a añadirlo a tu Perfil de gustos, empezando de cero, o solo quitarlo de esa lista. Si solo lo quitas de la lista, una escucha posterior puede añadirlo de nuevo. Abrir un perfil o una lista de reproducción no actualiza tu Perfil de gustos.

Los registros y el Perfil de gustos se usan para contar oyentes en las listas de descubrimiento, para que los creadores vean que su trabajo llega a las personas, y para que las recomendaciones puedan reflejar los programas que escuchas. No se venden, tu Perfil de gustos no se comparte con nadie más, y no se usan para hacerte publicidad. Las listas públicas muestran recuentos. No muestran quién escuchó, y esos recuentos no están ligados a tu cuenta.

Los registros de escucha se conservan durante {retention_days} días. {legal_name} elimina después un mes entero de registros de una vez, así que un registro puede permanecer hasta que se elimine su mes. Tu Perfil de gustos no sigue ese calendario. Permanece hasta que desactives el seguimiento de popularidad o elimines tu cuenta. Los recuentos ya publicados permanecen como números, sin una lista de quién escuchó.

Desactivar el seguimiento de popularidad pide confirmación. Al confirmar, {legal_name} elimina de inmediato tu Perfil de gustos, tu lista Oculto del perfil de gustos y tus registros de escucha guardados. Los recuentos públicos ya publicados permanecen. Si lo activas más adelante, las recomendaciones empiezan de cero. Si tu membresía termina, o si esta explicación cambia y aún no la has confirmado, los registros nuevos se detienen y tu Perfil de gustos permanece en pausa hasta que el seguimiento vuelva a estar activado. Tu lista Oculto del perfil de gustos permanece. Los registros de escucha ya guardados siguen caducando según ese calendario. El Perfil de gustos no se elimina en esos casos. Si lo desactivas, {legal_name} no volverá a preguntar cuando cambie la explicación. Si lo activas, y más adelante cambia qué se registra o cuánto tiempo se conserva, se te volverá a preguntar. Hasta que digas que sí, el seguimiento permanece desactivado.

Eliminar tu cuenta elimina el identificador, tus registros de escucha, tu Perfil de gustos y tu lista Oculto del perfil de gustos. Los recuentos públicos permanecen.

Para pedir una copia, una corrección o la eliminación antes de ese plazo, escribe a {contact_email}. Si nos negamos, responde a ese correo y revisaremos la solicitud de nuevo.
````

## French

Replace `## Suivi de popularité` through the `{contact_email}` paragraph in
`apps/api/legal/terms/fr.md` with:

````markdown
## Suivi de popularité

Le suivi de popularité est une fonctionnalité optionnelle. Il est disponible avec un abonnement Premium. Il reste désactivé jusqu'à ce que vous l'activiez, et vous pouvez le désactiver dans les paramètres du compte. Le désactiver ne limite pas la lecture, votre compte, ni un abonnement.

Lorsqu'il est activé, {legal_name} enregistre une écoute une fois que vous avez entendu 60 secondes, ou 25 % de l'épisode ou de la piste, selon ce qui arrive en premier. Chaque écoute comptée est son propre enregistrement. L'enregistrement comprend l'épisode ou la piste, le clip lorsque vous avez écouté un clip, l'émission à laquelle il appartient, combien de secondes vous avez entendues, si vous l'avez terminé, et l'heure. L'entendre à nouveau peut compter à nouveau. Il y a une limite quotidienne au nombre d'écoutes qui comptent. Sur le site web, l'ouverture du profil d'une autre personne est enregistrée, et l'ouverture d'une playlist est enregistrée. Ces ouvertures comptent uniquement pour les listes publiques. Elles ne mettent pas à jour votre Profil de goûts. L'ouverture de votre propre profil n'est pas enregistrée. Les applications mobiles n'enregistrent pas ces ouvertures. L'écoute sans être connecté n'est pas enregistrée de cette façon.

Chaque enregistrement conserve un identifiant aléatoire de votre compte. L'identifiant reste avec votre compte. Ce n'est pas votre nom, votre adresse e-mail, ni votre nom d'utilisateur public. {legal_name} peut relier cet identifiant à votre compte, de sorte que votre choix et une demande de suppression s'appliquent à vous. L'enregistrement n'est pas anonyme.

{legal_name} conserve aussi un Profil de goûts : une ligne par émission que vous écoutez (un podcast, un album ou un artiste). Les épisodes et les pistes n'ont pas leur propre ligne. Une écoute d'un épisode, d'une piste ou d'un clip met à jour l'émission à laquelle cela appartient. Une ligne conserve combien de fois vous avez écouté, combien vous avez terminées, quand vous avez écouté pour la première et la dernière fois, et une image de ce que vous avez écouté dernièrement et de ce que vous avez écouté sur une plus longue durée. Vous pouvez voir cette liste dans les paramètres du compte. Vous pouvez retirer une émission. L'émission passe alors dans Masqué du profil de goûts, et ses données de goût sont supprimées. Les écoutes ultérieures d'une émission masquée comptent encore sur les listes publiques, et elles ne rajoutent pas l'émission. Retirer une émission de Masqué du profil de goûts vous demande de la remettre dans votre Profil de goûts, en repartant de zéro, ou seulement de la retirer de cette liste. Si vous la retirez seulement de la liste, une écoute ultérieure peut l'ajouter de nouveau. Ouvrir un profil ou une playlist ne met pas à jour votre Profil de goûts.

Les enregistrements et le Profil de goûts servent à compter les auditeurs pour les listes de découverte, à permettre aux créateurs de voir que leur travail atteint des personnes, et à permettre aux recommandations de refléter les émissions que vous écoutez. Ils ne sont pas vendus, votre Profil de goûts n'est pas partagé avec qui que ce soit d'autre, et ils ne servent pas à vous adresser de la publicité. Les listes publiques affichent des décomptes. Elles ne montrent pas qui a écouté, et ces décomptes ne sont pas liés à votre compte.

Les enregistrements d'écoute sont conservés pendant {retention_days} jours. {legal_name} supprime ensuite un mois entier d'enregistrements d'un coup, de sorte qu'un enregistrement peut rester jusqu'à ce que son mois soit supprimé. Votre Profil de goûts ne suit pas ce calendrier. Il reste jusqu'à ce que vous désactiviez le suivi de popularité ou que vous supprimiez votre compte. Les décomptes déjà publiés demeurent sous forme de nombres, sans liste de qui a écouté.

Désactiver le suivi de popularité demande une confirmation. Après confirmation, {legal_name} supprime tout de suite votre Profil de goûts, votre liste Masqué du profil de goûts et vos enregistrements d'écoute conservés. Les décomptes publics déjà publiés restent. Si vous l'activez plus tard, les recommandations repartent de zéro. Si votre abonnement se termine, ou si cette explication change et que vous ne l'avez pas encore confirmée, les nouveaux enregistrements s'arrêtent et votre Profil de goûts reste en pause jusqu'à ce que le suivi soit de nouveau activé. Votre liste Masqué du profil de goûts reste. Les enregistrements d'écoute déjà conservés continuent d'expirer selon ce calendrier. Le Profil de goûts n'est pas supprimé dans ces cas. Si vous le désactivez, {legal_name} ne demandera plus lorsque l'explication change. Si vous l'activez, et que ce qui est enregistré ou la durée de conservation change plus tard, on vous demandera à nouveau. Tant que vous n'avez pas dit oui, le suivi reste désactivé.

Supprimer votre compte supprime l'identifiant, vos enregistrements d'écoute, votre Profil de goûts et votre liste Masqué du profil de goûts. Les décomptes publics restent.

Pour demander une copie, une correction ou une suppression plus tôt, écrivez à {contact_email}. Si nous refusons, répondez à cet e-mail et nous examinerons la demande à nouveau.
````

## Greek

Replace `## Παρακολούθηση δημοτικότητας` through the `{contact_email}` paragraph in
`apps/api/legal/terms/el-GR.md` with:

````markdown
## Παρακολούθηση δημοτικότητας

Η παρακολούθηση δημοτικότητας είναι μια προαιρετική λειτουργία. Είναι διαθέσιμη με συνδρομή Premium. Παραμένει απενεργοποιημένη μέχρι να την ενεργοποιήσετε, και μπορείτε να την απενεργοποιήσετε στις ρυθμίσεις λογαριασμού. Η απενεργοποίησή της δεν περιορίζει την αναπαραγωγή, τον λογαριασμό σας ή μια συνδρομή.

Όταν είναι ενεργή, η {legal_name} καταγράφει μια ακρόαση μόλις έχετε ακούσει 60 δευτερόλεπτα, ή το 25% του επεισοδίου ή του τραγουδιού, όποιο έρθει πρώτο. Κάθε ακρόαση που μετρά είναι η δική της εγγραφή. Η εγγραφή περιλαμβάνει το επεισόδιο ή το τραγούδι, το κλιπ όταν αναπαράξατε ένα κλιπ, την εκπομπή στην οποία ανήκει, πόσα δευτερόλεπτα ακούσατε, αν το τελειώσατε, και την ώρα. Αν το ακούσετε ξανά, μπορεί να μετρήσει ξανά. Υπάρχει ημερήσιο όριο στο πόσες ακροάσεις μετρούν. Στον ιστότοπο καταγράφεται το άνοιγμα του προφίλ ενός άλλου προσώπου, και καταγράφεται το άνοιγμα μιας λίστας αναπαραγωγής. Αυτά τα ανοίγματα μετρούν μόνο για τις δημόσιες λίστες. Δεν ενημερώνουν το Προφίλ γούστου σας. Το άνοιγμα του δικού σας προφίλ δεν καταγράφεται. Οι εφαρμογές για κινητά δεν καταγράφουν αυτά τα ανοίγματα. Η ακρόαση χωρίς σύνδεση στον λογαριασμό δεν καταγράφεται με αυτόν τον τρόπο.

Κάθε εγγραφή αποθηκεύει ένα τυχαίο αναγνωριστικό του λογαριασμού σας. Το αναγνωριστικό μένει με τον λογαριασμό σας. Δεν είναι το όνομά σας, το email σας ή το δημόσιο όνομα χρήστη σας. Η {legal_name} μπορεί να συνδέσει αυτό το αναγνωριστικό με τον λογαριασμό σας, ώστε η επιλογή σας και ένα αίτημα διαγραφής να ισχύουν για εσάς. Η εγγραφή δεν είναι ανώνυμη.

Η {legal_name} κρατά επίσης ένα Προφίλ γούστου: μια γραμμή για κάθε εκπομπή που ακούτε (ένα podcast, ένα άλμπουμ ή έναν καλλιτέχνη). Τα επεισόδια και τα τραγούδια δεν έχουν δική τους γραμμή. Μια ακρόαση ενός επεισοδίου, ενός τραγουδιού ή ενός κλιπ ενημερώνει την εκπομπή στην οποία ανήκει. Μια γραμμή κρατά πόσες φορές έχετε ακούσει, πόσες τελειώσατε, πότε ακούσατε για πρώτη και για τελευταία φορά, και μια εικόνα του τι ακούτε τελευταία και του τι έχετε ακούσει σε μεγαλύτερο διάστημα. Μπορείτε να δείτε αυτή τη λίστα στις ρυθμίσεις λογαριασμού. Μπορείτε να αφαιρέσετε μια εκπομπή. Η εκπομπή πηγαίνει τότε στο Κρυμμένο από το προφίλ γούστου, και τα δεδομένα γούστου της διαγράφονται. Οι μεταγενέστερες ακροάσεις μιας κρυμμένης εκπομπής εξακολουθούν να μετρούν στις δημόσιες λίστες, και δεν προσθέτουν ξανά την εκπομπή. Η αφαίρεση μιας εκπομπής από το Κρυμμένο από το προφίλ γούστου σας ρωτά αν θέλετε να την προσθέσετε ξανά στο Προφίλ γούστου σας, ξεκινώντας από την αρχή, ή μόνο να την αφαιρέσετε από αυτή τη λίστα. Αν την αφαιρέσετε μόνο από τη λίστα, μια μεταγενέστερη ακρόαση μπορεί να την προσθέσει ξανά. Το άνοιγμα ενός προφίλ ή μιας λίστας αναπαραγωγής δεν ενημερώνει το Προφίλ γούστου σας.

Οι εγγραφές και το Προφίλ γούστου χρησιμοποιούνται για να μετρούν τους ακροατές στις λίστες ανακάλυψης, ώστε οι δημιουργοί να βλέπουν ότι το έργο τους φτάνει σε ανθρώπους, και ώστε οι προτάσεις να μπορούν να αντικατοπτρίζουν τις εκπομπές που ακούτε. Δεν πωλούνται, το Προφίλ γούστου σας δεν κοινοποιείται σε κανέναν άλλον, και δεν χρησιμοποιούνται για διαφήμιση προς εσάς. Οι δημόσιες λίστες δείχνουν μετρήσεις. Δεν δείχνουν ποιος άκουσε, και αυτές οι μετρήσεις δεν συνδέονται με τον λογαριασμό σας.

Οι εγγραφές ακρόασης κρατιούνται για {retention_days} ημέρες. Η {legal_name} διαγράφει έπειτα έναν ολόκληρο μήνα εγγραφών μονομιάς, ώστε μια εγγραφή να μπορεί να μείνει μέχρι να αφαιρεθεί ο μήνας της. Το Προφίλ γούστου σας δεν ακολουθεί αυτό το χρονοδιάγραμμα. Μένει μέχρι να απενεργοποιήσετε την παρακολούθηση δημοτικότητας ή να διαγράψετε τον λογαριασμό σας. Οι μετρήσεις που έχουν ήδη δημοσιευτεί μένουν ως αριθμοί, χωρίς λίστα με το ποιος άκουσε.

Η απενεργοποίηση της παρακολούθησης δημοτικότητας ζητά επιβεβαίωση. Με την επιβεβαίωση, η {legal_name} διαγράφει αμέσως το Προφίλ γούστου σας, τη λίστα Κρυμμένο από το προφίλ γούστου και τις αποθηκευμένες εγγραφές ακρόασης. Οι δημόσιες μετρήσεις που έχουν ήδη δημοσιευτεί μένουν. Αν την ενεργοποιήσετε αργότερα, οι προτάσεις ξεκινούν από την αρχή. Αν η συνδρομή σας τελειώσει, ή αν αυτή η εξήγηση αλλάξει και δεν την έχετε επιβεβαιώσει ακόμη, οι νέες εγγραφές σταματούν και το Προφίλ γούστου σας μένει σε παύση μέχρι η παρακολούθηση να είναι ξανά ενεργή. Η λίστα Κρυμμένο από το προφίλ γούστου μένει. Οι εγγραφές ακρόασης που έχουν ήδη αποθηκευτεί συνεχίζουν να λήγουν σύμφωνα με αυτό το χρονοδιάγραμμα. Το Προφίλ γούστου δεν διαγράφεται σε αυτές τις περιπτώσεις. Αν την απενεργοποιήσετε, η {legal_name} δεν θα ρωτήσει ξανά όταν αλλάξει η εξήγηση. Αν την ενεργοποιήσετε, και αργότερα αλλάξει τι καταγράφεται ή πόσο καιρό κρατιέται, θα σας ρωτήσουμε ξανά. Μέχρι να πείτε ναι, η παρακολούθηση μένει απενεργοποιημένη.

Η διαγραφή του λογαριασμού σας διαγράφει το αναγνωριστικό, τις εγγραφές ακρόασης, το Προφίλ γούστου σας και τη λίστα Κρυμμένο από το προφίλ γούστου. Οι δημόσιες μετρήσεις μένουν.

Για να ζητήσετε αντίγραφο, διόρθωση ή διαγραφή νωρίτερα από αυτό, στείλτε email στο {contact_email}. Αν αρνηθούμε, απαντήστε σε αυτό το email και θα εξετάσουμε το αίτημα ξανά.
````

## Files

- `apps/api/legal/terms/en-US.md`
- `apps/api/legal/terms/es.md`
- `apps/api/legal/terms/fr.md`
- `apps/api/legal/terms/el-GR.md`
- `apps/api/src/lib/legal/termsContent.test.ts`

## Tests

Extend the existing case `serves popularity tracking as optional in every locale` in
`apps/api/src/lib/legal/termsContent.test.ts`. Keep the current heading and notice strings.
Add one more substring per locale, taken from the section above:

| Locale | Also expect |
| --- | --- |
| en-US | `Taste Profile` |
| es | `Perfil de gustos` |
| fr | `Profil de goûts` |
| el-GR | `Προφίλ γούστου` |

The English served markdown must still contain `not anonymous` and must not contain the
literal `{legal_address}`. The route test
`apps/api/src/test/terms-acceptance-gate.test.ts` already expects `Popularity Tracking` and
`optional`. Leave that file. Those words remain.

Do not snapshot the whole document. Do not edit `packages/helpers/src/lib/copyMarkdown.test.ts`.

Before finishing, search the four terms files' Popularity Tracking sections for `anonymized`,
`anonimizado`, `anonymisé`, and `ανωνυμοποιη`. None of those may appear. Do not change the
Cloudflare sentence to make that search pass.

Do not run tests in this turn.

## Release scratchpad

```markdown
## Terms describe listen records and the Taste Profile

- Surfaces: api, web, mobile
- Change: The Popularity Tracking section of the terms now matches the explanation: what a counted listen is, the Taste Profile and Hidden From Taste Profile list, how long listen records and the Taste Profile are kept, what is deleted when tracking is turned off, and what stays paused when tracking stops without that choice. The terms version does not change, so existing accounts are not asked to accept the terms again.
- Who notices: anyone who reads the terms
- Operator steps: none
```
