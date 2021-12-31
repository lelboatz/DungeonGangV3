import { client, DungeonGang } from "../index";
import { AutocompleteInteraction, GuildMember } from "discord.js";
import { MongoUser } from "./Mongo";
import { validUnicode } from "./Functions";

export default class EmojiManager {
    client: DungeonGang;
    member: GuildMember;
    emotes: string[];
    slots: any
    user?: MongoUser;

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
        // if (this.member.manageable) {
        //     const name = this.member.nickname?.split(" ")[0]
        //     if (!name) return;
        //     const newName = name[0] + " " + name[1] + " " + this.toString()
        //     return this.member.setNickname(newName, "Equipped emote")
        // }
    }

    unequip(slot: string) {
        if (this.slots[slot]) {
            this.slots[slot] = "none";
        }
        // if (this.member.manageable) {
        //     const name = this.member.nickname?.split(" ")[0]
        //     if (!name) return;
        //     const newName = name[0] + " " + name[1] + " " + this.toString()
        //     return this.member.setNickname(newName, "Unequipped emote")
        // }
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
        }
    }

}