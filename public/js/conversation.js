"use strict";

const SUPABASE_URL = "https://qgtpterfnrltrmsygbrh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_X8CN-z4V1TrT3eNmq_GrmQ_nNfDNrRU";
const STORAGE_KEY = "web101_guest_profile";

const conversationList = document.querySelector("#conversation-list");
const messageList = document.querySelector("#message-list");
const conversationTitle = document.querySelector("#conversation-title");
const chatStatus = document.querySelector("[data-chat-status]");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("[data-message-input]");
const newConversationButton = document.querySelector('[data-action="new-conversation"]');

const state = {
    supabase: null,
    channels: [],
    currentChannelId: null,
    messages: [],
    channelPreviewMap: new Map(),
    guestUser: null,
    realtimeSubscription: null,
};

function getOrCreateGuestUser() {
    const storedUser = window.sessionStorage.getItem(STORAGE_KEY);

    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            if (parsed && parsed.id && parsed.username) {
                return parsed;
            }
        } catch (error) {
            console.warn("Unable to parse stored guest profile.", error);
        }
    }

    const user = {
        id: window.crypto?.randomUUID?.() ?? `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        username: `Utilisateur ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    };

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
}

function setChatStatus(text, isError = false) {
    if (!chatStatus) {
        return;
    }

    chatStatus.textContent = text;
    chatStatus.hidden = text === "";
    chatStatus.style.color = isError ? "#b91c1c" : "#15803d";
}

function formatMessageTime(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatMessageDateTime(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString();
}

function truncatePreview(value, length = 45) {
    if (!value) {
        return "Aucun message";
    }

    const text = String(value).trim();
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function getChannelPreview(channelId) {
    const previewMessage = state.channelPreviewMap.get(channelId);

    if (!previewMessage) {
        return "Aucun message";
    }

    const author = previewMessage.username || "Utilisateur";
    return `${author}: ${truncatePreview(previewMessage.content)}`;
}

function getChannelTime(channelId) {
    const previewMessage = state.channelPreviewMap.get(channelId);

    if (!previewMessage?.created_at) {
        return { time: "", dateTime: "" };
    }

    return {
        time: formatMessageTime(previewMessage.created_at),
        dateTime: formatMessageDateTime(previewMessage.created_at),
    };
}

function renderChannelList() {
    if (!conversationList) {
        return;
    }

    conversationList.replaceChildren();

    if (!state.channels.length) {
        const emptyItem = document.createElement("li");
        const emptyButton = document.createElement("button");
        emptyButton.type = "button";
        emptyButton.className = "conversation-item";
        emptyButton.disabled = true;
        emptyButton.textContent = "Aucun salon disponible";
        emptyItem.append(emptyButton);
        conversationList.append(emptyItem);
        return;
    }

    for (const channel of state.channels) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const isActive = channel.id === state.currentChannelId;
        const preview = getChannelPreview(channel.id);
        const previewTime = getChannelTime(channel.id);

        button.type = "button";
        button.className = `conversation-item${isActive ? " is-active" : ""}`;
        button.dataset.conversationId = String(channel.id);
        button.setAttribute("aria-pressed", String(isActive));

        const nameNode = document.createElement("strong");
        nameNode.dataset.conversationName = "true";
        nameNode.textContent = channel.name || "Salon sans nom";

        const previewNode = document.createElement("span");
        previewNode.dataset.conversationPreview = "true";
        previewNode.textContent = preview;

        const timeNode = document.createElement("time");
        timeNode.dataset.conversationTime = "true";
        timeNode.textContent = previewTime.time;
        if (previewTime.dateTime) {
            timeNode.dateTime = previewTime.dateTime;
        }

        button.append(nameNode, previewNode, timeNode);
        button.addEventListener("click", () => {
            void selectChannel(channel.id);
        });

        item.append(button);
        conversationList.append(item);
    }
}

function renderMessages() {
    if (!messageList) {
        return;
    }

    messageList.replaceChildren();

    if (!state.messages.length) {
        const emptyMessage = document.createElement("li");
        emptyMessage.className = "message message-received";
        const text = document.createElement("p");
        text.className = "message-content";
        text.textContent = "Aucun message dans ce salon pour le moment.";
        emptyMessage.append(text);
        messageList.append(emptyMessage);
        return;
    }

    for (const message of state.messages) {
        const item = document.createElement("li");
        const isSent = String(message.user_id) === String(state.guestUser?.id ?? "");
        const authorName = message.username || "Utilisateur";

        item.classList.add("message", isSent ? "message-sent" : "message-received");

        const author = document.createElement("p");
        author.classList.add("message-author");
        author.textContent = authorName;

        const content = document.createElement("p");
        content.classList.add("message-content");
        content.textContent = message.content || "";

        const time = document.createElement("time");
        const dateTime = formatMessageDateTime(message.created_at);
        if (dateTime) {
            time.dateTime = dateTime;
        }
        time.textContent = formatMessageTime(message.created_at);

        item.append(author, content, time);
        messageList.append(item);
    }

    requestAnimationFrame(() => {
        if (messageList.scrollHeight > 0) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    });
}

async function fetchChannels() {
    if (!state.supabase) {
        console.log("[DB] fetchChannels skipped: supabase client not initialized");
        return;
    }

    console.log("[DB] fetchChannels: requesting channels...");
    const { data, error } = await state.supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: false });

    console.log("[DB] fetchChannels response:", { data, error });

    if (error) {
        throw error;
    }

    state.channels = Array.isArray(data) ? data : [];
    console.log("[DB] fetchChannels parsed channels:", state.channels);

    if (!state.channels.length) {
        state.channelPreviewMap.clear();
        renderChannelList();
        return;
    }

    const channelIds = state.channels.map((channel) => channel.id);
    console.log("[DB] fetchChannels: requesting last messages for channel ids:", channelIds);
    const { data: latestMessages, error: latestMessagesError } = await state.supabase
        .from("messages")
        .select("*")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false });

    console.log("[DB] fetchChannels latest messages response:", { latestMessages, latestMessagesError });

    if (latestMessagesError) {
        throw latestMessagesError;
    }

    const previewMap = new Map();
    const orderedMessages = Array.isArray(latestMessages) ? latestMessages : [];

    for (const message of orderedMessages) {
        if (!previewMap.has(message.channel_id)) {
            previewMap.set(message.channel_id, message);
        }
    }

    state.channelPreviewMap = previewMap;
    console.log("[DB] fetchChannels preview map:", Array.from(previewMap.entries()));
    renderChannelList();
}

async function fetchMessagesForChannel(channelId) {
    if (!state.supabase || !channelId) {
        console.log("[DB] fetchMessagesForChannel skipped: no supabase client or channel id");
        state.messages = [];
        renderMessages();
        return;
    }

    console.log(`[DB] fetchMessagesForChannel(${channelId}): requesting messages...`);
    const { data, error } = await state.supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });

    console.log("[DB] fetchMessagesForChannel response:", { channelId, data, error });

    if (error) {
        throw error;
    }

    state.messages = Array.isArray(data) ? data : [];
    console.log("[DB] fetchMessagesForChannel parsed messages:", state.messages);
    renderMessages();
}

function subscribeToCurrentChannel(channelId) {
    if (!state.supabase || !channelId) {
        console.log("[DB] subscribeToCurrentChannel skipped: no supabase client or channel id");
        return;
    }

    if (state.realtimeSubscription) {
        console.log("[DB] subscribeToCurrentChannel: removing previous subscription", state.realtimeSubscription);
        state.supabase.removeChannel(state.realtimeSubscription);
    }

    console.log(`[DB] subscribeToCurrentChannel(${channelId}): subscribing to INSERT events...`);
    state.realtimeSubscription = state.supabase
        .channel(`messages-${channelId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: `channel_id=eq.${channelId}`,
            },
            (payload) => {
                console.log("[DB] realtime INSERT payload:", payload);

                if (!payload?.new) {
                    return;
                }

                const insertedMessage = payload.new;
                const filteredMessages = state.messages.filter((message) => message.id !== insertedMessage.id);

                state.messages = [...filteredMessages, insertedMessage].sort((left, right) => {
                    const leftDate = new Date(left.created_at).getTime();
                    const rightDate = new Date(right.created_at).getTime();
                    return leftDate - rightDate;
                });

                state.channelPreviewMap.set(insertedMessage.channel_id, insertedMessage);
                console.log("[DB] realtime state.messages updated:", state.messages);
                console.log("[DB] realtime channelPreviewMap updated:", Array.from(state.channelPreviewMap.entries()));

                if (state.currentChannelId === insertedMessage.channel_id) {
                    renderMessages();
                }

                renderChannelList();
            }
        )
        .subscribe((status) => {
            console.log("[DB] realtime subscription status:", status);
        });
}

async function selectChannel(channelId) {
    if (!channelId) {
        return;
    }

    state.currentChannelId = channelId;

    const selectedChannel = state.channels.find((channel) => String(channel.id) === String(channelId));
    if (conversationTitle) {
        conversationTitle.textContent = selectedChannel?.name || "Conversation";
    }

    setChatStatus("En ligne");
    renderChannelList();

    try {
        await fetchMessagesForChannel(channelId);
        subscribeToCurrentChannel(channelId);
    } catch (error) {
        console.error("Unable to load messages", error);
        setChatStatus("Erreur lors du chargement des messages", true);
    }
}

async function handleSendMessage(event) {
    event.preventDefault();

    if (!messageInput || !state.supabase || !state.currentChannelId) {
        console.log("[SEND] message blocked: missing form, supabase or active channel", {
            hasMessageInput: Boolean(messageInput),
            hasSupabase: Boolean(state.supabase),
            currentChannelId: state.currentChannelId,
        });
        return;
    }

    const content = messageInput.value.trim();

    if (!content) {
        console.log("[SEND] message blocked: empty content");
        messageInput.focus();
        return;
    }

    const user = getOrCreateGuestUser();
    const payload = {
        channel_id: state.currentChannelId,
        user_id: user.id,
        username: user.username,
        content,
        created_at: new Date().toISOString(),
    };

    console.log("[SEND] payload prepared:", payload);

    try {
        const { data, error } = await state.supabase.from("messages").insert(payload).select();

        console.log("[SEND] insert response:", { data, error });

        if (error) {
            throw error;
        }

        messageInput.value = "";
        setChatStatus("En ligne");
        console.log("[SEND] message successfully inserted in DB:", data);
    } catch (error) {
        console.error("[SEND] Unable to send message", error);
        setChatStatus("Erreur lors de l’envoi du message", true);
    }
}

async function createChannel(name) {
    if (!state.supabase || !name || !name.trim()) {
        console.log("[DB] createChannel blocked: missing name or supabase client");
        return null;
    }

    const trimmedName = name.trim();
    const payload = {
        name: trimmedName,
        created_by: state.guestUser?.id || "guest-create-channel",
        created_at: new Date().toISOString(),
    };

    console.log("[DB] createChannel payload:", payload);

    const { data, error } = await state.supabase
        .from("channels")
        .insert(payload)
        .select()
        .single();

    console.log("[DB] createChannel response:", { data, error });

    if (error) {
        console.error("[DB] createChannel failed:", error);
        setChatStatus("Erreur lors de la création du salon", true);
        return null;
    }

    if (data) {
        state.channels = [data, ...state.channels];
        renderChannelList();
        await selectChannel(data.id);
        return data;
    }

    return null;
}

async function initApplication() {
    if (!conversationList || !messageList || !conversationTitle) {
        console.log("[BOOT] init skipped: page elements missing");
        return;
    }

    console.log("[BOOT] initApplication started");
    state.guestUser = getOrCreateGuestUser();
    console.log("[BOOT] guest user:", state.guestUser);

    const existingClient = window.supabase;

    if (existingClient) {
        console.log("[BOOT] reusing existing Supabase client");
        state.supabase = existingClient.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        });
    } else {
        console.log("[BOOT] loading Supabase SDK from CDN");
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = true;
        script.dataset.supabaseSdk = "true";

        await new Promise((resolve, reject) => {
            script.addEventListener("load", () => {
                console.log("[BOOT] Supabase SDK script loaded");
                if (window.supabase) {
                    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false,
                        },
                    });
                    console.log("[BOOT] Supabase client created:", state.supabase);
                    resolve();
                    return;
                }

                reject(new Error("Le client Supabase n’a pas été chargé."));
            }, { once: true });

            script.addEventListener("error", () => {
                reject(new Error("Le chargement du client Supabase a échoué."));
            }, { once: true });

            document.head.appendChild(script);
        });
    }

    try {
        console.log("[BOOT] fetching channels from DB");
        await fetchChannels();

        const firstChannel = state.channels[0];
        if (firstChannel) {
            console.log("[BOOT] selecting first channel:", firstChannel);
            await selectChannel(firstChannel.id);
        } else {
            conversationTitle.textContent = "Aucune conversation";
            renderMessages();
            setChatStatus("Aucun salon disponible");
        }
    } catch (error) {
        console.error("[BOOT] Unable to initialize conversations", error);
        conversationTitle.textContent = "Erreur de chargement";
        renderMessages();
        setChatStatus("Erreur de connexion à la base de données", true);
    }
}

if (messageForm) {
    messageForm.addEventListener("submit", (event) => {
        void handleSendMessage(event);
    });
}

if (newConversationButton) {
    newConversationButton.addEventListener("click", async () => {
        const channelName = window.prompt("Nom du nouveau salon ?", "Nouveau salon");

        if (channelName === null) {
            return;
        }

        await createChannel(channelName);
    });
}

void initApplication();
