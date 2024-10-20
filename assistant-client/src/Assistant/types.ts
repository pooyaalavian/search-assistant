
export interface BaseMessage {
    conversationId: string;
    messageId: string;
    sender: 'user' | 'assistant' | 'search_results' | 'search_request';
    content: string;
    timestamp: number;
}

export interface UserMessage extends BaseMessage {
    sender: 'user';
}

export interface SearchResultsMessage extends BaseMessage {
    sender: 'search_results';
    results: ChassisAiSearchResult[];
    query: string;
}

export interface SearchRequestMessage extends BaseMessage {
    sender: 'search_request';
    query: SearchKey[];
}

export interface AssistantMessage extends BaseMessage {
    sender: 'assistant';
    references: string[];
    followupPrompts: string[];
    actions: string[];
    liked: 1 | 0 | -1;
    state?: 'pending' | 'completed';
}

export type Message = UserMessage | AssistantMessage | SearchResultsMessage | SearchRequestMessage;

export type MessagePair = { userMessage: UserMessage, assistantMessage: AssistantMessage };

export interface Conversation {
    conversationId: string;
    // type: 'conversation';
    timestamp: number;
    userId: string;
    chassisId: IdString;
    messages: Message[];
}

export interface AssistantState {
    /** if null, it means the user is not in a chassis page. Otherwise, this value must be used for assistant interactions. */
    inContextChassisId: IdString | null;

    inContextUserName: string | null;

    /** weather the chat assistant panel is shown*/
    shown: boolean;

    active: boolean; // weather a chat session is created or not

    conversation: Conversation | null;

    status: 'ready' | 'loading' | 'error';
    
    error?: string;
}

/** iso format with timezone
 */
type DateTimeIsoString = string;

/** string or empty string
 * It's never non-string, so it's not a union type
 */
type OptionalString = string | "";

/** string 
 * adheres to the following format:
 * `C[0-9]{6}_[P|K][0-9]{4}`
 * e.g. `C751875_P2024`
 * the first 6 digits are chassis number
 * P|K is division
 * the last 4 digits are chassis year
 */
export type IdString = string;

export interface WindchillCadItem {
    product_item_id: string;
    part_number: string;
    part_name: string;
    part_version: string;
    part_state: string;
    last_modified_date: DateTimeIsoString;
    part_url: string;
    ID: IdString;
}

export interface ChassisAiSearchResult {
    division: "P" | "K";
    chassis_number: string;
    chassis_year: "20" | "21" | "22" | "23" | "24" | "25";
    schedule_date: DateTimeIsoString;
    dealer: OptionalString;
    intended_service: OptionalString;
    tag_suspension: OptionalString;
    quarter_fenders: OptionalString;
    rear_suspension: OptionalString;
    lift_axle_location: OptionalString;
    c_i_non_steerable_pusher_info: OptionalString;
    c_i_steerable_pusher_info: OptionalString;
    pusher_suspension_non_steerable: OptionalString;
    pusher_suspension_steerable: OptionalString;
    wheelbase: OptionalString;
    def_tank_location: OptionalString;
    battery_box_location: OptionalString;
    hydraulic_tank_location: OptionalString;
    fuel_tank_location1: OptionalString;
    fuel_tank_location2: OptionalString;
    fuel_tank_location3: OptionalString;
    fuel_tank_location4: OptionalString;
    frame_access_steps: OptionalString;
    def_tank: OptionalString;
    battery_box: OptionalString;
    hydraulic_tank: OptionalString;
    transmission: OptionalString;
    fuel_tanks_add_replace1: OptionalString;
    fuel_tanks_add_replace2: OptionalString;
    fuel_tanks_add_replace3: OptionalString;
    fuel_tanks_add_replace4: OptionalString;
    exhaust_system: OptionalString;
    unit_type: OptionalString;
    sleeper: OptionalString;
    auxillary_transmission: OptionalString;
    plant_location: OptionalString;
    base_model: OptionalString;
    customer_name: OptionalString;
    air_dryer: OptionalString;
    air_system: OptionalString;
    air_tank_location: OptionalString;
    air_tank_options: OptionalString;
    battery_disconnect_switches: OptionalString;
    chain_hooks_hangers_box: OptionalString;
    driveline1: OptionalString;
    driveline2: OptionalString;
    driveline3: OptionalString;
    driveline4: OptionalString;
    fifth_wheel_setting: OptionalString;
    frame_access_grab_handles: OptionalString;
    frame_rail_size: OptionalString;
    fuel_fill_options: OptionalString;
    full_insert: OptionalString;
    partial_insert: OptionalString;
    partial_insert_location: OptionalString;
    dummy: OptionalString;
    ID: IdString;
    description: string;
    defects: number;
    metadata_storage_last_modified: DateTimeIsoString;
    metadata_storage_content_md5: string;
    metadata_storage_name: string;
    metadata_storage_path: string;
    metadata_storage_file_extension: string;
    links: WindchillCadItem[];
    _score?: number;
}

export interface SearchKey{
    name: string;
    id:string;
    type: 'top'|'broad'|'extended';
    mandatory: boolean;
    selected:boolean;
}
