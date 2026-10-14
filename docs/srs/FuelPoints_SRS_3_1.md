**SOFTWARE REQUIREMENTS  
SPECIFICATION (SRS)**

**FuelPoints**

Верзија 3.1 Implementation Baseline

Аутор: Ана Спасојевић  
Датум: 1. октобар 2026.

# Историја верзија

| **Верзија** | **Опис**                                                   |
|-------------|------------------------------------------------------------|
| 1.0         | Почетна спецификација.                                     |
| 2.0         | Проширена спецификација.                                   |
| 3.0         | Формализовани loyalty, security, API и verification модел. |
| 3.1         | Поједностављени implementation baseline за дипломски рад.  |

# 1. УВОД

## 1.1 Сврха документа

Овај документ дефинише функционалне и нефункционалне захтјеве FuelPoints MVP система. Верзија 3.1 представља коначни baseline за имплементацију дипломског рада. Обим је ограничен тако да задржи кључне архитектонске и алгоритамске аспекте система: серверску ауторитативност, атомске трансакције, идемпотенцију, concurrency контролу, loyalty ledger, reward voucher state machine и Firestore Security Rules. Функционалности које нису неопходне за ово језгро свјесно су изостављене.

## 1.2 Опсег производа

FuelPoints је Android loyalty систем за кориснике бензинске станице. MVP омогућава:

- регистрацију и пријаву корисника;

- обнову постојеће Auth сесије;

- промјену лозинке и password reset;

- приказ корисничког профила;

- приказ loyalty стања;

- customer loyalty QR;

- књижење куповине горива преко POS Simulator-а;

- аутоматски обрачун бодова;

- преглед историје куповина;

- каталог награда;

- издавање reward voucher-а;

- отказивање voucher-а;

- истек voucher-а;

- redemption voucher-а преко POS Simulator-а;

- immutable loyalty ledger;

- in-app нотификације;

- контролисано брисање корисничког налога;

- статички Help/FAQ.

Опционално проширење је push достава нотификација преко FCM-а. Push није услов прихватања MVP-а.

## 1.3 Функционалности ван опсега

- iOS апликација;

- production POS интеграција;

- административни web портал;

- платне картице и payment gateway;

- PAN/CVV;

- промјена e-mail адресе;

- обавезна e-mail верификација;

- поновно прихватање нових верзија услова;

- бодовање куповина у маркету;

- екран историје reward voucher-а;

- ручна административна корекција бодова;

- POS refund/reversal workflow;

- маркетиншке кампање;

- приказ цијена горива;

- сложени offline режим;

- production hosting Backend-а.

## 1.4 Дефиниције

**UID:** Firebase Authentication user identifier.

**Loyalty Account:** Серверски контролисано тренутно стање бодова корисника.

**availablePoints:** Бодови који се могу користити за издавање нових награда.

**reservedPoints:** Бодови резервисани активним reward voucher-има.

**Customer Loyalty QR:** QR код који садржи Firebase UID и служи само за идентификацију loyalty налога при куповини.

**Reward Voucher QR:** QR код са opaque voucherId који се користи за redemption конкретне награде.

**Loyalty Backend:** Trusted server компонента која спроводи business rules и једина може директно мијењати критичне loyalty податке.

**POS Simulator:** Једноставан контролисани клијент који симулира касу бензинске станице.

**Ledger:** Immutable евиденција сваке промјене loyalty стања.

**Idempotency:** Својство по којем поновљени исти логички захтјев не производи додатни пословни ефекат.

**Server timestamp:** Вријеме које одређује Backend/Firebase server environment.

## 1.5 Правило бодовања

За сваки пуни литар горива корисник добија један бод. Ако је количина горива изражена у милилитрима:

earnedPoints = floor(volumeMl / 1000)

- 900 ml → 0 бодова;

- 10 000 ml → 10 бодова;

- 10 990 ml → 10 бодова;

- 42 730 ml → 42 бода.

Бодови су увијек integer.

# 2. ТЕХНИЧКА АРХИТЕКТУРА

## 2.1 Компоненте

1.  Android App;

2.  Loyalty Backend;

3.  POS Simulator;

4.  Firebase Authentication;

5.  Cloud Firestore.

Опционо: Firebase Cloud Messaging (FCM).

## 2.2 Android App

Android App је непоуздани клијент у смислу business integrity-ја. Апликација може аутентификовати корисника, читати сопствене дозвољене Firestore податке, мијењати ограничена профилна поља, приказивати customer QR и иницирати Backend операције.

Апликација не смије директно:

- мијењати број бодова;

- креирати потврђену куповину;

- креирати ledger event;

- креирати reward voucher;

- мијењати voucher status;

- вршити redemption.

## 2.3 Loyalty Backend

Нормативна Backend технологија је Node.js 24 LTS, Express и Firebase Admin SDK. Backend се у MVP development/demo окружењу покреће као локални Node.js процес на развојном рачунару. Production cloud hosting није дио обавезног MVP-а. Cloud Functions for Firebase нису normative deployment target овог MVP-а. Ако би се користиле за production deployment, Firebase project мора бити на Blaze billing плану према тренутним Firebase условима; тај deployment није неопходан за израду и одбрану дипломског рада.

## 2.4 Firebase Emulator Suite

Током развоја и аутоматског тестирања користи се Firebase Emulator Suite за Firestore, Firebase Authentication гдје је практично и Security Rules тестове. Тестови који мијењају податке не смију користити production Firebase project.

## 2.5 POS Simulator

POS Simulator треба бити минимална имплементација. Дозвољени облици су једна HTML страница, CLI програм или Postman колекција. Препоручена имплементација је једноставна HTML страница. POS Simulator не мора имати QR scanner; Customer UID се може ручно унијети или копирати са Android QR екрана.

Основна POS форма за куповину садржи loyalty UID, POS transaction ID, количину горива, износ, валуту и вријеме куповине. Redemption форма садржи voucher ID и redemption request ID.

## 2.6 Android QR библиотека

Android апликацији је потребна само функција генерисања QR кода. Може се користити ZXing или еквивалентна библиотека. Android MVP не садржи QR scanner.

# 3. TRUST И AUTHORIZATION МОДЕЛ

## 3.1 Зоне повјерења

### Android App

Untrusted client. Мора се претпоставити да корисник може модификовати APK, заобићи UI валидацију, ручно конструисати API request, мијењати локални storage и системски сат.

### POS Simulator

Controlled client. Trusted је само за POS input податке након успјешне service authentication.

### Loyalty Backend

Trusted business authority.

### Firebase

Trusted managed infrastructure.

## 3.2 Основни безбједносни принцип

Клијент који контролише крајњи корисник не смије непосредно створити, повећати, резервисати, потрошити или вратити loyalty вриједност.

## 3.3 Android Backend authentication

Заштићени Android endpoint-и користе Authorization: Bearer \<Firebase-ID-token\>. Backend верификује token, добија UID из token-а и не прихвата client-supplied UID као user authority.

## 3.4 POS authentication

POS endpoint-и користе header X-POS-API-Key: \<secret\>. За сваку станицу постоји посебан random API key. Backend configuration садржи мапирање API key → stationId. POS API key се чува у environment variable/configuration secret-у, не смије бити у source repository-ју или Android APK-у и не смије се логовати. stationId се никада не прихвата као ауторитативно поље из POS request body-ја.

## 3.5 Firebase Authentication конфигурација

Firebase Authentication користи e-mail/password login. E-mail verification није обавезна у MVP-у. Email Enumeration Protection мора бити укључен. UI при погрешном login-у користи генеричку поруку: „E-mail adresa ili lozinka nisu ispravni.“

## 3.6 Password policy

Firebase Authentication password policy и Android client validation морају користити исто правило: минимум 8 знакова, најмање једно велико слово и најмање једна цифра. Client-side validation служи UX-у; Firebase Auth policy је коначна server-side контрола. Firebase Authentication password policy мора бити конфигурисан у enforcement режиму Require, тако да server-side authentication слој одбија нову лозинку која не испуњава дефинисану политику.

# 4. КОРИСНИЧКИ ИНТЕРФЕЈС

MVP има приближно осам главних екрана.

## UI-01 — Welcome/Login

Садржи e-mail, лозинку, Login, Register и Forgotten password.

## UI-02 — Registration

Садржи display name, e-mail, password, password confirmation и прихватање услова. Телефон и датум рођења се не прикупљају.

## UI-03 — Home

Приказује display name, available points, reserved points ако су \>0, offline/stale marker за cached balance и приступ QR-у, purchases, Rewards, Notifications и Settings. При отварању Home-а Android позива voucher reconciliation endpoint.

## UI-04 — Customer Loyalty QR

Приказује QR са Firebase UID-ом и UID као текст испод QR-а. Customer QR није credential нити reward voucher.

## UI-05 — Purchase History

Приказује датум, количину горива, износ, валуту и earned points. Сортирање је occurredAt DESC, 20 записа по страници, cursor pagination само за purchases.

## UI-06 — Rewards

Један екран обухвата reward catalog, eligibility приказ, active voucher-е, reward QR, countdown до expiry-а и cancel action. Не постоји засебан voucher history екран.

## UI-07 — Notifications

Приказује до 50 најновијих in-app notifications. Нема cursor pagination и нема груписања „Данас/Јуче“. Нова notification има readAt = null; отварање поставља readAt.

## UI-08 — Settings / Profile / Help

Обухвата display name, Auth e-mail као read-only податак, промјену лозинке, password reset link ако је потребно, Help/FAQ, Logout и Delete Account. Промјена e-mail адресе није дио MVP-а.

# 5. ACCOUNT LIFECYCLE

## AUTH-01 — Регистрација

Android валидира форму, креира Firebase Auth account, добија ID token и позива POST /api/v1/account/init.

## AUTH-02 — Account initialization

POST /account/init у једној Firestore transaction креира users/{uid} и loyaltyAccounts/{uid}. Ниједан од ова два документа не смије остати самостално креиран ако transaction не успије.

Канонски users/{uid} документ има облик:

{ displayName: string, accountStatus: "ACTIVE" \| "DELETION_IN_PROGRESS", createdAt: timestamp, updatedAt: timestamp, acceptedTermsVersion: string, acceptedTermsAt: timestamp }

Поља accountStatus, createdAt, acceptedTermsVersion и acceptedTermsAt су server-controlled. Почетно loyalty стање је availablePoints = 0 и reservedPoints = 0

## AUTH-03 — NOT_INITIALIZED

NOT_INITIALIZED није вриједност Firestore enum-а. Логичко стање значи да Firebase Auth account постоји, али users/{uid} не постоји или account initialization није завршен. Android тада поново покушава /account/init.

## AUTH-04 — ACTIVE

Постојећи users/{uid} са accountStatus = ACTIVE означава оперативан FuelPoints налог.

## AUTH-05 — DELETION_IN_PROGRESS

Када брисање започне, accountStatus = DELETION_IN_PROGRESS. Нове loyalty mutation операције се одбијају. Поновљени DELETE /account наставља исти idempotent cleanup workflow.

## AUTH-06 — Session restore

Ако Firebase Auth session постоји и account је ACTIVE, Android приказује Home без поновног password login-а.

## AUTH-07 — Logout

Logout поништава локалну Firebase Auth session и не мијења server data.

## AUTH-08 — Password change

Корисник може промијенити лозинку путем Firebase Authentication-а; по потреби се користи recent reauthentication.

## AUTH-09 — Forgotten password

Login екран може покренути Firebase password reset e-mail flow. FuelPoints Backend не учествује у password reset-у.

## AUTH-10 — Услови коришћења

Верзија услова и server timestamp прихватања уписују се приликом /account/init. Не постоји посебан terms-acceptance endpoint; поновно прихватање будућих верзија услова није дио MVP-а.

# 6. CUSTOMER LOYALTY QR

**QR-01 —** Customer QR садржи Firebase UID.

**QR-02 —** QR се генерише локално.

**QR-03 —** Без важеће Auth session нема QR-а.

**QR-04 —** Не постоји "guest" QR.

**QR-05 —** UID се приказује и као текст.

## QR-06 — Прихваћени ризик

Статички Firebase UID није тајна и може бити фотографисан или копиран. Овај ризик се експлицитно прихвата у MVP-у зато што customer QR служи искључиво за кредитирање бодова. Customer QR не може служити за authentication, читање приватних података, издавање reward-а, redemption или трошење бодова.

# 7. МОДЕЛ LOYALTY БОДОВА

## 7.1 Loyalty account

{  
availablePoints: integer,  
reservedPoints: integer,  
createdAt: timestamp,  
updatedAt: timestamp  
}

lifetimeEarnedPoints се не користи.

## 7.2 Инваријанти

availablePoints \>= 0  
reservedPoints \>= 0

## 7.3 EARN

Ако purchase доноси p бодова: availablePoints += p. Ledger event: EARN.

## 7.4 RESERVE

При issue-у reward-а цијене p: availablePoints -= p; reservedPoints += p. Ledger event: REWARD_RESERVE.

## 7.5 REDEEM

При успјешном redemption-у: reservedPoints -= p. availablePoints се не мијења. Ledger event: REWARD_REDEEM.

## 7.6 RELEASE

При expiry-у или cancellation-у: reservedPoints -= p; availablePoints += p. Ledger event: REWARD_RELEASE.

# 8. PURCHASE MODEL

## 8.1 Purchase ID

posTransactionId није глобално јединствен између различитих станица. Business identity куповине је (stationId, posTransactionId). Firestore document ID је {stationId}\_\_{posTransactionId}, нпр. SIM01\_\_000184.

## 8.2 ID validation

stationId и posTransactionId користе само \[A-Za-z0-9.\_-\]. Знак / није дозвољен. posTransactionId има 1–64 знака.

## 8.3 Purchase schema

{  
uid: string \| null,  
stationId: string,  
posTransactionId: string,  
volumeMl: integer,  
amountMinor: integer,  
currency: string,  
earnedPoints: integer,  
occurredAt: timestamp,  
recordedAt: timestamp  
}

uid може постати null након account deletion pseudonymization-а.

## 8.4 POS input validation

| **Поље**         | **Услов**                                                                    |
|------------------|------------------------------------------------------------------------------|
| loyaltyUid       | Мора одговарати постојећем ACTIVE FuelPoints налогу.                         |
| posTransactionId | ^\[A-Za-z0-9.\_-\]{1,64}\$                                                   |
| volumeMl         | integer; 1 ≤ volumeMl ≤ 200000                                               |
| amountMinor      | integer; 0 ≤ amountMinor ≤ 1000000                                           |
| currency         | MVP whitelist: EUR                                                           |
| occurredAt       | Валидан timestamp; не више од 5 минута у будућности у односу на server time. |

## 8.5 Server-derived purchase fields

POS не смије слати као ауторитативна поља stationId, earnedPoints или recordedAt. Backend station ID добија из API key мапе, earned points рачуна из volumeMl и recordedAt поставља као server time.

# 9. PURCHASE TRANSACTION И НОТИФИКАЦИЈА

Успјешна purchase операција мора у једној Firestore transaction креирати или измијенити: purchase, loyalty balance, EARN ledger event и in-app notification.

## 9.1 Notification ID

Points-earned notification користи deterministic ID: earn\_{purchaseId}. Примјер: earn_SIM01\_\_000184.

## 9.2 Notification schema

{  
uid: string,  
type: "POINTS_EARNED",  
title: string,  
body: string,  
createdAt: timestamp,  
readAt: timestamp \| null,  
relatedPurchaseId: string  
}

## 9.3 Crash consistency

- purchase не може бити commit-ован без in-app notification-а;

- server crash одмах након commit-а не губи notification;

- duplicate POS request не креира другу notification.

# 10. PURCHASE IDEMPOTENCY

## 10.1 Први request

Ако purchase document не постоји, Backend валидира податке, креира purchase, додјељује бодове, креира ledger и notification.

## 10.2 Retry са истим payload-ом

Ако исти (stationId, posTransactionId) већ постоји и business payload одговара оригиналном request-у, Backend враћа резултат прве операције. Нема новог EARN-а.

## 10.3 Retry са различитим payload-ом

Исти (stationId, posTransactionId) са различитим UID, volume, amount или currency даје 409 IDEMPOTENCY_CONFLICT.

# 11. LOYALTY LEDGER

{  
uid: string \| null,  
type: "EARN" \| "REWARD_RESERVE" \| "REWARD_REDEEM" \| "REWARD_RELEASE",  
deltaAvailable: integer,  
deltaReserved: integer,  
availableAfter: integer,  
reservedAfter: integer,  
purchaseId: string \| null,  
voucherId: string \| null,  
createdAt: timestamp  
}

Ledger је immutable. Android нема direct read нити write приступ ledger-у. Ledger је Backend/audit ресурс. Након account deletion-а uid се поставља на null.

# 12. REWARD CATALOG

{  
displayName: string,  
costPoints: integer,  
active: boolean  
}

| **Reward ID** | **Назив**       | **Cost** |
|---------------|-----------------|----------|
| CAR_WASH      | Бесплатно прање | 50       |
| SHOWER        | Бесплатан туш   | 30       |

Android може читати каталог. Android не може мијењати cost.

# 13. REWARD ISSUE

Endpoint: POST /api/v1/rewards/{rewardId}/issue

{  
"requestId": "UUID"  
}

requestId мора бити UUID v4 који Android генерише једном за један логички reward-issue покушај. Retry истог логичког захтјева мора поново користити исти requestId; нови кориснички покушај мора добити нови requestId. Backend сам одређује UID, cost, voucher ID, status и timestamps.

## 13.1 Reward issue предуслови

- user account је ACTIVE;

- reward постоји;

- reward је active;

- expired vouchers су reconcile-овани;

- availablePoints \>= costPoints.

## 13.2 Reward issue transaction

1.  availablePoints -= cost;

2.  reservedPoints += cost;

3.  креира се ACTIVE voucher;

4.  креира се REWARD_RESERVE;

5. креира се reward idempotency mapping.

# 14. REWARD ISSUE IDEMPOTENCY

Internal resource: rewardRequests/{requestKey}. requestKey се може формирати као SHA-256(uid + ":" + requestId).

{  
uid: string,  
requestId: string,  
rewardId: string,  
voucherId: string,  
createdAt: timestamp  
}

Исти (uid, requestId) враћа исти voucher и не резервише бодове други пут. Исти request ID за други reward даје 409 IDEMPOTENCY_CONFLICT.

# VOUCHER MODEL

voucherId генерише искључиво Loyalty Backend помоћу криптографски безбједног генератора случајних вриједности. Идентификатор мора бити opaque и имати најмање 128 бита ентропије. Android и POS не смију бирати voucherId.

{  
uid: string,  
rewardId: string,  
costPoints: integer,  
status: "ACTIVE" \| "REDEEMED" \| "EXPIRED" \| "CANCELLED",  
issuedAt: timestamp,  
expiresAt: timestamp,  
redeemedAt: timestamp \| null,  
cancelledAt: timestamp \| null,  
redeemedAtStationId: string \| null  
}

requestId није неопходно поље на voucher-у; idempotency mapping је у rewardRequests.

# 16. VOUCHER STATE MACHINE

Почетно стање је ACTIVE. Дозвољени прелази су ACTIVE → REDEEMED, ACTIVE → EXPIRED и ACTIVE → CANCELLED. Терминална стања се не напуштају.

# 17. VOUCHER EXPIRY

Voucher важи 15 минута. Backend поставља expiresAt = issuedAt + 15 min. Локални Android сат није authority.

# 18. LAZY RECONCILIATION

Reconciliation се покреће при отварању Home-а, интерно прије reward issue-а и при redemption-у конкретног voucher-а. Account-level endpoint је POST /api/v1/account/vouchers/reconcile.

## 18.1 Reconcile expired voucher-а

За сваки ACTIVE voucher за који је serverTime \>= expiresAt, у једној transaction се врши ACTIVE → EXPIRED, reservedPoints -= costPoints, availablePoints += costPoints и креира REWARD_RELEASE. Release се дешава највише једном.

# 19. VOUCHER CANCELLATION

Endpoint: POST /api/v1/vouchers/{voucherId}/cancel. Request body није потребан. Cancellation је state-idempotent.

## 19.1 Успјешан cancel

1. status → CANCELLED;

2. cancelledAt = serverTime;

3. reservedPoints -= cost;

4. availablePoints += cost;

5. креира се REWARD_RELEASE.

## 19.2 Поновљен cancel

Ако је voucher већ CANCELLED, Backend враћа постојеће CANCELLED стање и не креира нови refund.

## 19.3 Недозвољен cancel

REDEEMED voucher даје 409 VOUCHER_ALREADY_REDEEMED. EXPIRED voucher даје 409 VOUCHER_EXPIRED.

# 20. REDEMPTION

Endpoint: POST /api/v1/pos/vouchers/{voucherId}/redeem

{  
"redemptionRequestId": "POS-RDM-001"  
}

## 20.1 Redemption request validation

redemptionRequestId мора одговарати ^\[A-Za-z0-9.\_-\]{1,64}\$. Station ID долази из POS API key-а.

## 20.2 Redemption idempotency

Internal resource: redemptionRequests/{requestKey}, гдје се requestKey изводи из stationId + ":" + redemptionRequestId.

{  
stationId: string,  
uid: string,

redemptionRequestId: string,  
voucherId: string,  
resultStatus: string,  
createdAt: timestamp  
}

uid поставља Backend из voucher документа и служи искључиво за controlled cleanup приликом брисања налога; POS га не шаље. Поновљен исти request ID за исти voucher враћа исти резултат. Исти request ID за други voucher даје 409 IDEMPOTENCY_CONFLICT.

## 20.3 Успјешан redemption

1. ACTIVE → REDEEMED;

2. поставља се redeemedAt;

3. поставља се redeemedAtStationId;

4. reservedPoints -= costPoints;

5. креира се REWARD_REDEEM;

6. креира се redemption idempotency record.

availablePoints се не смањује.

## 20.4 Redemption већ искоришћеног voucher-а

Нови request ID за већ REDEEMED voucher даје 409 VOUCHER_ALREADY_REDEEMED.

## 20.5 Redemption истеклог ACTIVE voucher-а

Ако voucher физички има status ACTIVE, али је serverTime \>= expiresAt, Backend у истој Firestore transaction врши ACTIVE → EXPIRED, reservedPoints -= cost, availablePoints += cost и креира REWARD_RELEASE. Након успјешног commit-а endpoint враћа 409 VOUCHER_EXPIRED. На тај начин бодови не остају резервисани до будућег reconciliation позива.

# 21. IN-APP NOTIFICATIONS

In-app notifications су дио обавезног MVP-а. Push није.

## 21.1 Notification source of truth

Firestore је једини ауторитативни извор in-app notification-а.

## 21.2 Read state

Нова notification има readAt = null. Отварање ставке поставља readAt = server timestamp. Корисник може мијењати само readAt.

## 21.3 Нема pagination-а

Notification screen учитава до 50 најновијих notification-а. Нема cursor pagination.

# 22. ОПЦИОНИ FCM PUSH

FCM push није услов прихватања дипломског MVP-а. Ако се имплементира, Firestore notification настаје прва, push је best-effort delivery, а push failure не мијења business state. Опциони device resource је users/{uid}/devices/{fid}. Ако се FCM push накнадно имплементира, његов device-registration data model и одговарајућа Firestore Security Rules правила дефинишу се као засебно проширење и нису дио обавезног MVP baseline-а.

# 23. ACCOUNT DELETION

Endpoint: DELETE /api/v1/account. Захтијева recent authentication: auth_time \<= 5 min.

## 23.1 Delete workflow

1. ако status није DELETION_IN_PROGRESS, поставља га;

2. блокира нове loyalty mutations;

3. затвара ACTIVE voucher-е;

4. брише user-owned transient/private ресурсе;

5. псеудонимизује historical business records;

6. брише Firebase Auth account посљедњи.

## 23.2 Ресурси који се бришу

- users/{uid};

- loyaltyAccounts/{uid};

- user notifications;

- optional device registrations;

- user vouchers;

- reward request mappings;

- redemptionRequests записи за које је uid једнак UID-у корисника који се брише.

## 23.3 Historical resources

purchases и loyaltyLedger се не бришу у MVP project policy-ју. Они се псеудонимизују постављањем uid = null. Ако би друго директно user-identifying поље било накнадно додато, и оно се уклања. Ово је пројектна data-lifecycle одлука, а не тврдња о правној compliance усаглашености.

## 23.4 Resume deletion

Ако Backend затекне accountStatus = DELETION_IN_PROGRESS, поновљени DELETE request наставља cleanup. Не почиње нови независан deletion flow. Пошто је Firebase Auth deletion посљедњи корак, server-side cleanup је завршен прије губитка могућности аутентификованог retry-ја.

# 24. КАНОНСКЕ FIRESTORE КОЛЕКЦИЈЕ

users/{uid}  
loyaltyAccounts/{uid}  
purchases/{stationId\_\_posTransactionId}  
loyaltyLedger/{eventId}  
rewardDefinitions/{rewardId}  
vouchers/{voucherId}  
notifications/{notificationId}  
rewardRequests/{requestKey}  
redemptionRequests/{requestKey}

Не постоје cards, payments, qr field нити lifetimeEarnedPoints.

# 25. FIRESTORE SECURITY POLICY

## 25.1 Основни принцип

Default deny. Android директно чита само ресурсе који су му неопходни.

## 25.2 users/{uid}

Owner get: ALLOW. Update displayName и updatedAt: ALLOW. Create/delete: DENY.

## 25.3 loyaltyAccounts/{uid}

Owner get: ALLOW. Write: DENY.

## 25.4 purchases

Owner query: ALLOW ако query гарантује uid == request.auth.uid. Direct client write: DENY.

## 25.5 loyaltyLedger

Android read: DENY. Android write: DENY. Ledger није Android UI resource.

## 25.6 rewardDefinitions

Authenticated Android read: ALLOW. Write: DENY.

## 25.7 vouchers

Owner може читати сопствене voucher документе потребне Rewards екрану. Client write: DENY.

## 25.8 notifications

Owner read: ALLOW. readAt: null → request.time: ALLOW. Друга измјена: DENY.

## 25.9 Internal collections

rewardRequests и redemptionRequests: client read/write DENY.

## 25.10 Unknown resources

Све што није експлицитно дозвољено: DENY.

# 26. BACKEND API

Base URL: /api/v1. MVP има тачно седам business endpoint-а.

| **ID** | **Endpoint**                                 | **Auth**                   | **Input**                                                                 |
|--------|----------------------------------------------|----------------------------|---------------------------------------------------------------------------|
| API-01 | POST /api/v1/account/init                    | Android Auth               | displayName, acceptedTermsVersion                                         |
| API-02 | POST /api/v1/pos/purchases                   | POS API key                | loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAt |
| API-03 | POST /api/v1/rewards/{rewardId}/issue        | Android Auth               | requestId                                                                 |
| API-04 | POST /api/v1/pos/vouchers/{voucherId}/redeem | POS API key                | redemptionRequestId                                                       |
| API-05 | POST /api/v1/vouchers/{voucherId}/cancel     | Android Auth               | без body-ја                                                               |
| API-06 | POST /api/v1/account/vouchers/reconcile      | Android Auth               | без business input-а                                                      |
| API-07 | DELETE /api/v1/account                       | Android Auth + recent auth | без body-ја                                                               |

# 27. ERROR CATALOG

Стандардни error body:

{  
"error": {  
"code": "ERROR_CODE",  
"message": "Opis greške",  
"correlationId": "..."  
}  
}

| **Code**                     | **HTTP** | **Значење**                           |
|------------------------------|----------|---------------------------------------|
| UNAUTHENTICATED              | 401      | Firebase token недостаје/није важећи  |
| UNAUTHENTICATED_POS          | 401      | POS API key недостаје/није важећи     |
| FORBIDDEN                    | 403      | Познат identity нема право            |
| ACCOUNT_NOT_INITIALIZED      | 409      | FuelPoints профил не постоји          |
| ACCOUNT_DELETION_IN_PROGRESS | 409      | Налог се брише                        |
| REAUTHENTICATION_REQUIRED    | 409      | Auth није довољно recent              |
| INVALID_DISPLAY_NAME         | 422      | Display name није валидан             |
| INVALID_TRANSACTION_ID       | 422      | POS transaction ID није валидан       |
| INVALID_VOLUME               | 422      | volumeMl ван опсега                   |
| INVALID_AMOUNT               | 422      | amountMinor ван опсега                |
| UNSUPPORTED_CURRENCY         | 422      | Валута није на whitelist-и            |
| INVALID_OCCURRED_AT          | 422      | Timestamp није прихватљив             |
| LOYALTY_ACCOUNT_NOT_FOUND    | 404      | UID нема ACTIVE loyalty account       |
| IDEMPOTENCY_CONFLICT         | 409      | Исти idempotency ID, различит payload |
| REWARD_NOT_FOUND             | 404      | Reward не постоји                     |
| REWARD_INACTIVE              | 409      | Reward није активан                   |
| INSUFFICIENT_POINTS          | 409      | Нема довољно available points         |
| VOUCHER_NOT_FOUND            | 404      | Voucher не постоји                    |
| VOUCHER_EXPIRED              | 409      | Voucher је истекао                    |
| VOUCHER_CANCELLED            | 409      | Voucher је отказан                    |
| VOUCHER_ALREADY_REDEEMED     | 409      | Voucher је већ искоришћен             |
| INTERNAL_ERROR               | 500      | Неочекивана server грешка             |
| SERVICE_UNAVAILABLE          | 503      | Зависни сервис није доступан          |

Backend не смије враћати stack trace клијенту.

# 28. NON-FUNCTIONAL REQUIREMENTS

## NFR-01 — HTTPS и authentication

Production network комуникација мора користити HTTPS. Сваки Android protected endpoint мора верификовати Firebase ID token. Verification: API negative tests.

## NFR-02 — POS authentication

Сваки POS endpoint мора захтијевати важећи X-POS-API-Key. Verification: request без/са погрешним key-ом мора бити одбијен.

## NFR-03 — Firestore default deny

Security Rules морају користити default deny и owner isolation. Critical client writes морају бити забрањени. Verification: Rules test suite.

## NFR-04 — Атомичност

Purchase, reward issue, redemption, expiry и cancellation не смију оставити partial business state. Verification: integration tests са transaction failure сценаријима.

## NFR-05 — Идемпотенција

Purchase, reward issue и redemption морају бити retry-safe. Verification: поновљени request не смије произвести други business effect.

## NFR-06 — Concurrency и double-spend

Ако balance није довољан за два паралелна reward request-а, не могу оба успјети. Verification: concurrent integration test.

## NFR-07 — Secrets

Firebase Admin credentials и POS API keys не смију бити у Android APK-у, source repository-ју или client logs. Verification: inspection.

## NFR-08 — Cached balance

Ако Firestore balance snapshot има metadata.isFromCache == true, Home мора приказати stale/offline marker. Остали сложени offline сценарији нису обавезни. Verification: offline test.

## NFR-09 — Android compatibility

Smoke test мора проћи најмање на API 26 и API 35 emulator-у: login, Home, QR, purchases, reward, notifications, Settings/logout.

## NFR-10 — Accessibility minimum

Сваки важан touch target мора бити најмање 48×48 dp. Функционална икона без видљивог textual label-а мора имати contentDescription. Verification: UI inspection.

# 29. API TEST CATALOG

## API-T01 — Account init

Валидан init креира profile и balance 0/0. Поновљени init не ресетује state.

## API-T02 — Earn

Purchase од 42 730 ml даје тачно 42 бода. Креирани су purchase, EARN, balance update и deterministic notification.

## API-T03 — Purchase idempotency

Поновљени исти (stationId, posTransactionId) са истим payload-ом не додаје бодове поново.

## API-T04 — Purchase conflict/validation

Исти purchase ID са другачијим payload-ом даје IDEMPOTENCY_CONFLICT. Невалидан volume/currency/timestamp се одбија.

## API-T05 — Insufficient reward

49 available points не може издати CAR_WASH од 50. State остаје непромијењен.

## API-T06 — Reward reserve/idempotency

50 available points издаје један wash voucher: available 0, reserved 50. Retry истог request ID-а не резервише поново.

## API-T07 — Reward concurrency

Са 50 бодова два паралелна wash request-а не могу оба успјети.

## API-T08 — Redemption

Важећи ACTIVE voucher постаје REDEEMED, reserved се смањује и креира се REWARD_REDEEM.

## API-T09 — Redemption idempotency

Поновљен исти redemption request враћа исти резултат без другог ledger effect-а.

## API-T10 — Expired redemption

Истекао ACTIVE voucher при redemption-у у истој transaction постаје EXPIRED, враћа бодове и креира REWARD_RELEASE; API враћа VOUCHER_EXPIRED.

## API-T11 — Cancellation

ACTIVE voucher постаје CANCELLED и враћа бодове једном. Поновљен cancel не враћа бодове поново.

## API-T12 — Account deletion

Deletion брише profile/balance/notifications/vouchers, поставља uid=null у purchases и ledger, Auth account брише посљедњи и поновљен DELETION_IN_PROGRESS request наставља cleanup.

# 30. FIRESTORE RULES TEST CATALOG

| **Тест** | **Очекивани резултат**                                                              |
|----------|-------------------------------------------------------------------------------------|
| RULE-T01 | Unauthenticated read users/{uid} → DENY.                                            |
| RULE-T02 | Owner read сопственог profile-а → ALLOW.                                            |
| RULE-T03 | Cross-user profile read → DENY.                                                     |
| RULE-T04 | Owner update само displayName + updatedAt → ALLOW.                                  |
| RULE-T05 | Profile update који додаје server/unknown field → DENY.                             |
| RULE-T06 | Owner read сопственог loyaltyAccounts/{uid} → ALLOW.                                |
| RULE-T07 | Client write над loyalty account → DENY.                                            |
| RULE-T08 | Owner-constrained purchase query → ALLOW; direct purchase write → DENY.             |
| RULE-T09 | Owner read сопственог voucher-а → ALLOW; voucher write → DENY.                      |
| RULE-T10 | Owner notification read и readAt null→timestamp → ALLOW; измјена body/title → DENY. |
| RULE-T11 | Било какав Android read/write над loyaltyLedger → DENY.                             |
| RULE-T12 | Client access над internal/unknown collection → DENY.                               |

# 31. FIRESTORE RULES — НОРМАТИВНА ПОЛИТИКА

Нормативни MVP скуп правила:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }
    function ownResource() {
      return signedIn()
      && resource.data.uid == request.auth.uid;
    }
    function changedOnly(fields) {
      return request.resource.data
      .diff(resource.data)
      .affectedKeys()
      .hasOnly(fields);
    }
    match /users/{uid} {
      allow get: if isOwner(uid);
      allow list, create, delete: if false;
      allow update: if isOwner(uid)
      && changedOnly(\['displayName', 'updatedAt'\])
      && request.resource.data.displayName is string
      && request.resource.data.displayName.size() \>= 1
      && request.resource.data.displayName.size() \<= 100
      && request.resource.data.updatedAt == request.time;
    }
    match /loyaltyAccounts/{uid} {
      allow get: if isOwner(uid);
      allow list, create, update, delete: if false;
    }
    match /purchases/{purchaseId} {
      allow get: if ownResource();
      allow list: if ownResource()
      && request.query.limit != null
      && request.query.limit \<= 20;
      allow create, update, delete: if false;
    }
    match /loyaltyLedger/{eventId} {
      allow read, write: if false;
    }
    match /rewardDefinitions/{rewardId} {
      allow read: if signedIn();
      allow write: if false;
    }
    match /vouchers/{voucherId} {
      allow get: if ownResource();
      allow list: if ownResource()
      && request.query.limit != null
      && request.query.limit \<= 20;
      allow create, update, delete: if false;
    }
    match /notifications/{notificationId} {
      allow get: if ownResource();
      allow list: if ownResource()
      && request.query.limit != null
      && request.query.limit \<= 50;
      allow create, delete: if false;
      allow update: if ownResource()
      && changedOnly(\['readAt'\])
      && resource.data.readAt == null
      && request.resource.data.readAt is timestamp
      && request.resource.data.readAt == request.time;
    }
    match /rewardRequests/{requestKey} {
      allow read, write: if false;
    }
    match /redemptionRequests/{requestKey} {
      allow read, write: if false;
    }
    match /{document=\*\*} {
      allow read, write: if false;
    }
  }
}
```

# 32. ACCEPTANCE CRITERIA

| **ID** | **Критеријум**                                                                   |
|--------|----------------------------------------------------------------------------------|
| AC-01  | Корисник може регистровати се, пријавити се, обновити session и одјавити се.     |
| AC-02  | Android корисник не може директно повећати сопствене бодове.                     |
| AC-03  | Валидна POS куповина од 42,730 l додаје 42 бода тачно једном.                    |
| AC-04  | Customer QR садржи UID и не може бити коришћен као reward voucher.               |
| AC-05  | Reward issue резервише бодове атомски.                                           |
| AC-06  | Два конкурентна request-а не могу потрошити исте бодове.                         |
| AC-07  | Voucher се може redeem-овати највише једном.                                     |
| AC-08  | Истекао или отказан voucher враћа резервисане бодове највише једном.             |
| AC-09  | Ledger садржи одговарајући immutable event за сваки loyalty mutation.            |
| AC-10  | In-app notification о бодовима настаје атомски са purchase-ом.                   |
| AC-11  | Account deletion псеудонимизује purchase и ledger историју постављањем uid=null. |
| AC-12  | Свих 12 Backend API тестова и свих 12 Firestore Rules тестова пролази.           |

# 33. РИЗИЦИ И ОГРАНИЧЕЊА

## 33.1 Static UID QR

UID QR може бити копиран. Ризик је прихваћен јер QR не даје право на трошење бодова или приступ приватним подацима.

## 33.2 POS Simulator

POS Simulator није production POS integration. Он служи искључиво за доказивање API и loyalty lifecycle-а.

## 33.3 Backend hosting

Production hosting није дио дипломског MVP-а. Локални Node/Express Backend је довољан за development, тестирање и демонстрацију.

## 33.4 Push

Push notification delivery није гарантована и није дио core acceptance-а. In-app notification систем мора радити независно.

## 33.5 Data pseudonymization

Постављање uid=null у historical records је пројектна pseudonymization политика. Документ не тврди да тиме аутоматски настаје правно анонимизован запис.

# 34. КОНАЧНИ MVP ОБИМ

## 34.1 Обавезне компоненте

- Android App;

- Node.js 24 LTS / Express Backend;

- Firebase Authentication;

- Cloud Firestore;

- Firebase Emulator Suite;

- POS Simulator;

- Firestore Security Rules.

## 34.2 Опционо

Firebase Cloud Messaging push.

## 34.3 Приближан UI обим

Осам главних екрана.

## 34.4 Backend

Седам business endpoint-а.

## 34.5 Главни академски фокус

- trusted/untrusted boundary;

- server authority;

- transactional consistency;

- idempotency;

- concurrency;

- double-spend prevention;

- immutable ledger;

- state machine;

- Firestore authorization.

# 35. ЗАКЉУЧАК

FuelPoints SRS 3.1 дефинише ограничен, али комплетан MVP који је реалан за имплементацију у оквиру дипломског рада. Систем не покушава да симулира production payment, POS или административни ecosystem. Умјесто тога, фокусира се на коректност loyalty механизма.

Критична business state промјена не зависи од Android клијента, већ од trusted Backend-а. Purchase, reward issue, redemption, cancellation и expiry користе контролисане Firestore transaction операције. Идемпотенција спречава duplicate business effect, а concurrency model спречава double-spend.

Immutable ledger омогућава сљедивост промјена, док Firestore Security Rules обезбјеђују least-privilege приступ Android клијента. Ова верзија представља нормативни implementation baseline FuelPoints дипломског пројекта.

# ПРИЛОГ A — ТЕХНИЧКЕ РЕФЕРЕНЦЕ

- Node.js release schedule: <u>https://nodejs.org/en/about/previous-releases</u>

- Firebase Cloud Functions — Get started: <u>https://firebase.google.com/docs/functions/get-started</u>

- Firebase Authentication — Password auth: <u>https://firebase.google.com/docs/auth/android/password-auth</u>

- Firebase Cloud Messaging — registration management: <u>https://firebase.google.com/docs/cloud-messaging/manage-tokens</u>

- Firebase Admin Node release notes: <u>https://firebase.google.com/support/release-notes/admin/node</u>

- Cloud Firestore Security Rules — fields: <u>https://firebase.google.com/docs/firestore/security/rules-fields</u>
