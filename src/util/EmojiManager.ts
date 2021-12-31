import { client, DungeonGang } from "../index";
import { AutocompleteInteraction, GuildMember } from "discord.js";
import { MongoUser } from "./Mongo";
import { validUnicode } from "./Functions";
import axios, { AxiosResponse } from "axios";
import levenshtein from "js-levenshtein"

interface EmojiResponse {
    name: string;
    unified: string | null;
    non_qualified: string | null;
    docomo: string | null;
    au: string | null;
    softbank: string | null;
    google: string | null;
    image: string | null;
    sheet_x: number | null;
    sheet_y: number | null;
    short_name: string | null;
    short_names: string[] | null;
    text: string | null;
    texts: string[] | null;
    category: string;
    subcategory: string;
    sort_order: number;
    added_in: string;
    has_img_apple: boolean;
    has_img_google: boolean;
    has_img_twitter: boolean;
    has_img_facebook: boolean;
}

export default class EmojiManager {
    client: DungeonGang;
    member: GuildMember;
    emotes: string[];
    slots: any
    user?: MongoUser;
    private static emoteCache?: { name: string, value: string }[];

    constructor(member: GuildMember) {
        this.client = client;
        this.member = member;
        this.emotes = [];
        this.slots = {}
    }

    async update() {
        const user = await this.client.mongo.getUserByDiscord(this.member.id) as MongoUser | undefined;
        if (!user) {
            return;
        } else {
            this.emotes = this.removeDuplicates(user.emotes.given.concat(this.getAvailableEmotes()))
            this.slots = EmojiManager.mergeSlots(user.emotes.slots, this.getAvailableSlots())
            user.emotes.slots = this.slots;
            this.removeLockedEmotes()
        }
        this.user = user;
    }

    async sync() {
        if (!this.user) {
            return;
        }
        this.user.emotes.slots = this.slots;
        await this.client.mongo.updateUser(this.user);
    }

    giveEmote(emote: string) {
        if (validUnicode(emote) && !this.user?.emotes.given.includes(emote)) {
            this.user?.emotes.given.push(emote);
        }
    }

    takeEmote(emote: string) {
        if (validUnicode(emote) && this.user?.emotes.given.includes(emote)) {
            this.user?.emotes.given.splice(this.user?.emotes.given.indexOf(emote), 1);
        }
    }

    getEmojiInSlot(slot: string): string | undefined {
        return this.slots[slot] !== "none" ? this.slots[slot] : undefined;
    }

    equip(slot: string, emote: string) {
        if (validUnicode(emote)) {
            if (this.slots[slot]) {
                this.slots[slot] = emote;
            }
        }
        if (this.member.manageable) {
            const name = this.member.nickname?.split(" ")
            if (!name) return;
            const newName = name[0] + " " + name[1] + " " + this.toString()
            return this.member.setNickname(newName, "Equipped emote")
        }
    }

    unequip(slot: string) {
        if (this.slots[slot]) {
            this.slots[slot] = "none";
        }
        if (this.member.manageable) {
            const name = this.member.nickname?.split(" ")
            if (!name) return;
            const newName = name[0] + " " + name[1] + " " + this.toString()
            return this.member.setNickname(newName, "Unequipped emote")
        }
    }

    getSlotFromEmote(emote: string): string | undefined {
        for (const slot in this.slots) {
            if (this.slots[slot] === emote) {
                return slot;
            }
        }
        return undefined;
    }

    getSlotName(index: number): string | undefined {
        return Object.keys(this.slots)[index - 1]
    }

    getSlotIndex(slot: string): number {
        return Object.keys(this.slots).indexOf(slot) + 1
    }

    getEmoteByName(name: string) {
        for (const milestone of this.client.config.emotes.milestones) {
            if (milestone.name === name) {
                return milestone.emote;
            }
        }
    }

    removeLockedEmotes() {
        for (const [key, value] of Object.entries(this.slots)) {
            if (value !== "none" && !this.emotes.includes(value as any)) {
                this.slots[key] = "none";
            }
        }
    }

    public toString() {
        return Object.values(this.slots).filter(slot => slot !== "none").join("")
    }

    public removeDuplicates(array: any[]) {
        return [...new Set(array)];
    }

    private getAvailableEmotes() {
        const emotes = [];
        for (const milestone of this.client.config.emotes.milestones) {
            if (this.member.roles.cache.has(milestone.role)) {
                if (milestone.requires) {
                    if (this.member.roles.cache.has(milestone.requires)) {
                        emotes.push(milestone.emote)
                    }
                } else {
                    emotes.push(milestone.emote)
                }
            }
        }
        return emotes;
    }

    private getAvailableSlots() {
        const slots: any = {
            default: "none"
        };
        for (const slot of this.client.config.emotes.slots) {
            if (this.member.roles.cache.has(slot.role)) {
                slots[slot.name] = "none";
            }
        }
        return slots;
    }

    private static mergeSlots(slots: any, availableSlots: any) {
        for (const [key, value] of Object.entries(slots)) {
            if (availableSlots[key]) {
                availableSlots[key] = value;
            }
        }
        return availableSlots;
    }

    public static async autocomplete(interaction: AutocompleteInteraction) {
        if (interaction.options.getFocused(true).name === "emote") {
            if (interaction.commandName === "equip") {
                const manager = new this(interaction.member as GuildMember)
                await manager.update();
                await manager.sync()
                const response = [];
                for (const emote of manager.emotes) {
                    response.push({
                        name: emote,
                        value: emote
                    })
                }
                return interaction.respond(response);
            } else if (interaction.commandName === "give") {
                let response: any[];
                const value = interaction.options.getFocused(true).value as string
                if (value.length === 0) {
                    response = await this.random25Emotes();
                    return interaction.respond(response);
                } else {
                    if (validUnicode(value)) {
                        response = [{
                            name: value,
                            value: value
                        }]
                        return interaction.respond(response);
                    }
                    response = await this.closestMatches(value);
                    return interaction.respond(response);
                }
            } else if (interaction.commandName === "take") {
                const user = interaction.options.get("user")
                if (!user?.value) {
                    return interaction.respond([])
                }
                const member = await client.commands.get("take").fetchMember(user.value, interaction.guild!)
                if (!member) {
                    return interaction.respond([])
                }

                const manager = new this(member as GuildMember)
                await manager.update();
                if (!manager.user) {
                    return interaction.respond([])
                }
                await manager.sync()
                const response = [];
                for (const emote of manager.user?.emotes.given!) {
                    response.push({
                        name: emote,
                        value: emote
                    })
                }
                return interaction.respond(response);
            }
        }
    }

    public static async fetchAllEmotes() {
        if (this.emoteCache) {
            return this.emoteCache;
        }
        const response: AxiosResponse<EmojiResponse[]> = await axios.get("https://raw.githubusercontent.com/iamcal/emoji-data/master/emoji_pretty.json")

        const emotes = response.data
            .filter(emote => emote.unified && emote.short_name && emote.has_img_twitter)
            .map(emote => {
                return {
                    name: emote.short_name!,
                    value: this.codePointToUnicode(emote.unified!)
                }
            })
            .filter(emote => validUnicode(emote.value))
        this.emoteCache = emotes;
        return emotes;
    }


    public static codePointToUnicode(codePoint: string) {
        let code = parseInt(codePoint, 16);
        if (code > 0xFFFF) {
            code -= 0x10000;
            return String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
        }
        return String.fromCharCode(code);
    }

    public static async random25Emotes() {
        return (await EmojiManager.fetchAllEmotes()
            .then(emotes => {
                const response = [];
                for (let i = 0; i < 25; i++) {
                    const randomIndex = Math.floor(Math.random() * emotes.length);
                    response.push(emotes[randomIndex]);
                }
                return response;
            }))
            .map(emote => {
                return {
                    name: emote.value,
                    value: emote.value
                }
            })
    }

    public static async closestMatches(emoji: string): Promise<{ name: string, value: string }[]> {
        const emotes = await this.fetchAllEmotes();
        const closest = emotes.map(emote => {
            return {
                name: emote.name,
                value: emote.value,
                distance: levenshtein(emote.name, emoji)
            }
        }).sort((a, b) => a.distance - b.distance)
            .map(emote => {
                return {
                    name: emote.value,
                    value: emote.value
                }
            })
        return closest.slice(0, 25);
    }
}