"use strict";

const conversationList = document.querySelector("#conversation-list");
const messageList = document.querySelector("#message-list");
const conversationTitle = document.querySelector("#conversation-title");
const chatStatus = document.querySelector("[data-chat-status]");

if (conversationList && messageList && conversationTitle) {
    const conversationButtons = Array.from(
        conversationList.querySelectorAll(".conversation-item[data-conversation-id]")
    );
    const initialActiveButton = conversationButtons.find((button) =>
        button.classList.contains("is-active")
    );
    const initialActiveId = initialActiveButton?.dataset.conversationId;
    const conversations = new Map();

    for (const button of conversationButtons) {
        const id = button.dataset.conversationId;
        const name = button.querySelector("[data-conversation-name]");

        if (!id || !name) {
            continue;
        }

        const preview = button.querySelector("[data-conversation-preview]");
        const time = button.querySelector("[data-conversation-time]");
        let messages = [];

        if (id === initialActiveId) {
            messages = Array.from(messageList.querySelectorAll(".message")).map((element) => {
                const author = element.querySelector(".message-author");
                const content = element.querySelector(".message-content");
                const messageTime = element.querySelector("time");

                return {
                    author: author?.textContent ?? "",
                    content: content?.textContent ?? "",
                    dateTime: messageTime?.dateTime ?? "",
                    time: messageTime?.textContent ?? "",
                    type: element.classList.contains("message-sent") ? "sent" : "received",
                };
            });
        } else if (preview?.textContent) {
            messages = [{
                author: name.textContent ?? "",
                content: preview.textContent,
                dateTime: time?.dateTime ?? "",
                time: time?.textContent ?? "",
                type: "received",
            }];
        }

        conversations.set(id, {
            name: name.textContent ?? "",
            preview: preview?.textContent ?? "",
            time: time?.textContent ?? "",
            dateTime: time?.dateTime ?? "",
            status: id === initialActiveId ? chatStatus?.textContent ?? "" : "",
            messages,
        });
    }

    function renderMessages(messages) {
        messageList.replaceChildren();

        for (const message of messages) {
            const item = document.createElement("li");
            item.classList.add("message", `message-${message.type}`);

            const author = document.createElement("p");
            author.classList.add("message-author");
            author.textContent = message.author;

            const content = document.createElement("p");
            content.classList.add("message-content");
            content.textContent = message.content;

            const time = document.createElement("time");
            if (message.dateTime) {
                time.dateTime = message.dateTime;
            }
            time.textContent = message.time;

            item.append(author, content, time);
            messageList.append(item);
        }
    }

    function selectConversation(id) {
        const conversation = conversations.get(id);

        if (!conversation) {
            return;
        }

        conversationTitle.textContent = conversation.name;
        renderMessages(conversation.messages);

        if (chatStatus) {
            chatStatus.textContent = conversation.status;
            chatStatus.hidden = conversation.status === "";
        }

        for (const button of conversationButtons) {
            const buttonId = button.dataset.conversationId;
            const buttonConversation = conversations.get(buttonId);
            const isActive = buttonId === id;

            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));

            if (buttonConversation) {
                const preview = button.querySelector("[data-conversation-preview]");
                const time = button.querySelector("[data-conversation-time]");

                if (preview) {
                    preview.textContent = buttonConversation.preview;
                }
                if (time) {
                    if (buttonConversation.dateTime) {
                        time.dateTime = buttonConversation.dateTime;
                    } else {
                        time.removeAttribute("datetime");
                    }
                    time.textContent = buttonConversation.time;
                }
            }
        }
    }

    conversationList.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        const button = event.target.closest(".conversation-item[data-conversation-id]");
        if (button && conversationList.contains(button)) {
            selectConversation(button.dataset.conversationId);
        }
    });

    if (initialActiveId && conversations.has(initialActiveId)) {
        selectConversation(initialActiveId);
    }
}
