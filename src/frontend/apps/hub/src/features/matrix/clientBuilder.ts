import {
  BackupDownloadStrategy,
  ClientBuilder,
  type ClientBuilderLike,
  ClientLike,
  ClientSessionDelegate,
  IndexedDbStoreBuilder,
  Session as SessionInterface,
  SlidingSyncVersion,
  SlidingSyncVersionBuilder,
} from "@/index.web";

interface BaseBuilderOptions {
    sessionDelegate: ClientSessionDelegate;
    setupEncryption: boolean;
    slidingSync: "discover" | "restored";
    passphrase?: string;
    storeName?: string;
}

/**
 * Create a base client builder with common configuration
 */
function createBaseClientBuilder(
    options: BaseBuilderOptions,
): ClientBuilderLike {
    let builder: ClientBuilderLike = new ClientBuilder();

    // Add sliding sync configuration
    if (options.slidingSync === "discover") {
        builder = builder.slidingSyncVersionBuilder(
            SlidingSyncVersionBuilder.DiscoverNative,
        );
    }
    // Note: for "restored", we don't add slidingSyncVersionBuilder
    // as it will be configured when restoring the session

    // Configure IndexedDB storage with optional passphrase
    const storeName = options.storeName || "aurora-store";
    const storeBuilder = new IndexedDbStoreBuilder(storeName);
    if (options.passphrase) {
        builder = builder.indexeddbStore(
            storeBuilder.passphrase(options.passphrase),
        );
    } else {
        builder = builder.indexeddbStore(storeBuilder);
    }

    // Add encryption configuration if requested
    if (options.setupEncryption) {
        builder = builder.autoEnableCrossSigning(true);
        builder = builder.backupDownloadStrategy(
            BackupDownloadStrategy.AfterDecryptionFailure,
        );
        // Note: We don't use autoEnableBackups(true) because we want to manually
        // set up recovery and capture the recovery key to use as the IndexedDB passphrase
    }

    // Add session delegate if provided
    if (options.sessionDelegate) {
        builder = builder.setSessionDelegate(options.sessionDelegate);
    }

    return builder;
}

/**
 * Generates a random passphrase for IndexedDB encryption
 */
function generatePassphrase(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}

/**
 * Creates an authentication client for login flows
 * Each auth session gets a unique store ID
 * Returns the client, passphrase, and storeId to be saved with the session
 */
export async function createAuthenticationClient(
    serverNameOrUrl: string,
    sessionDelegate: ClientSessionDelegate,
): Promise<{ client: ClientLike; passphrase: string; storeId: string }> {
    // Generate passphrase for this authentication session
    const passphrase = generatePassphrase();

    // Generate a unique store ID
    const sessionStore = new SessionStore();
    const storeId = sessionStore.generateStoreId();

    // Create store name from the ID
    const storeName = sessionStore.getStoreName(storeId);

    console.log("[createAuthenticationClient] Creating new auth client");

    // Create client with unique store and encryption enabled
    const client = await createBaseClientBuilder({
        sessionDelegate,
        setupEncryption: true,
        slidingSync: "discover",
        passphrase,
        storeName,
    })
        .serverNameOrHomeserverUrl(serverNameOrUrl)
        .build();

    return { client, passphrase, storeId };
}

/**
 * Restores a client from a saved session
 *
 * IMPORTANT: Uses the same storeId that was generated during authentication
 * to access the correct isolated IndexedDB store for this user.
 */
export async function restoreClient(
    session: SessionInterface,
    passphrase: string,
    storeId: string,
    sessionDelegate: ClientSessionDelegate,
): Promise<ClientLike> {
    console.log("[restoreClient] Starting restoration");

    // Explicitly set the sliding sync version to .native when restoring
    const sessionWithSlidingSync = {
        ...session,
        slidingSyncVersion: SlidingSyncVersion.Native,
    };

    // Use the same store name that was created during authentication
    const sessionStore = new SessionStore();
    const storeName = sessionStore.getStoreName(storeId);
    console.log(`[restoreClient] - storeName: ${storeName}`);

    const builder: ClientBuilderLike = createBaseClientBuilder({
        sessionDelegate,
        setupEncryption: true,
        slidingSync: "restored",
        passphrase,
        storeName,
    });

    const client = await builder.homeserverUrl(session.homeserverUrl).build();

    console.log("Restoring session...");
    await client.restoreSession(sessionWithSlidingSync);
    console.log("Session restored successfully");
    return client;
}

/**
 * Validates that the client is using native sliding sync
 * Throws an error if not, as we only support native sliding sync
 */
export function validateNativeSlidingSync(client: ClientLike): void {
    const version = client.slidingSyncVersion();
    if (version !== SlidingSyncVersion.Native) {
        throw new Error(
            "This homeserver does not support native sliding sync. Please contact your homeserver administrator.",
        );
    }
}
