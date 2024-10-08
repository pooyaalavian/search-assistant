from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
import json

# todo: calc this dynamically
total_attributes = 33


class AISearchClient:
    def __init__(self, search_endpoint, search_index_name, search_key):
        self.service_endpoint = search_endpoint
        self.index_name = search_index_name
        self.key = search_key
        self.search_client = SearchClient(
            self.service_endpoint, self.index_name, AzureKeyCredential(self.key)
        )

    def get_chassis_by_id(self, chassis_id)->dict:
        results = self.search_client.search(
            search_text=chassis_id,
            skip=0,
            search_fields=["ID"],
            include_total_count=True,
        )
        
        count = results.get_count()
        if count != 1:
            raise ValueError(f"Expected 1 result, got {count} results.")
        
        for item in results:
            return item

        return None

    def calculate_matching_score(self, result, chaissis, attributes):
        match_count = 0
        for attribute in attributes:
            key = attribute.split(":")[0]
            key = key.split("'")[1]  # Extract the key name from the string
            if result.get(key) == chaissis.get(key):
                match_count += 1
        return match_count / total_attributes

    def get_matching_chassis(self, chassis_id, count_needed=10) -> list[dict]:
        chassis = self.get_chassis_by_id(chassis_id)
        if not chassis:
            return []

        all_matched_chassis = []
        
        search_keys = [
            "dealer",
            "intended_service",
            "tag_suspension",
            "quarter_fenders",
            "rear_suspension",
            "lift_axle_location",
            "wheelbase",
            "c_i_non_steerable_pusher_info",
            "c_i_steerable_pusher_info",
            "pusher_suspension_non_steerable",
            "pusher_suspension_steerable",
            "def_tank_location",
            "battery_box_location",
            "hydraulic_tank_location",
            "fuel_tank_location1",
            "fuel_tank_location2",
            "fuel_tank_location3",
            "fuel_tank_location4",
            "frame_access_steps",
            "def_tank",
            "battery_box",
            "hydraulic_tank",
            "transmission",
            "fuel_tanks_add_replace1",
            "fuel_tanks_add_replace2",
            "fuel_tanks_add_replace3",
            "fuel_tanks_add_replace4",
            "exhaust_system",
            "unit_type",
            "sleeper",
            "auxillary_transmission",
            "plant_location",
            "chassis_year",
            "base_model",
        ]
        search_criteria = [ f"{key}: '{chassis[key]}'" for key in search_keys]
        total_attributes = len(search_criteria)

        match_criteria = total_attributes

        while search_criteria:
            search = " + ".join(search_criteria)

            iterator = self.search_client.search(
                search_text=search,
                search_mode="all",
                skip=0,
                include_total_count=True,
            )

            count = iterator.get_count()
            if count > 0:
                for result in iterator:
                    if result["ID"] != chassis["ID"]:
                        score = match_criteria / total_attributes
                        result["_score"] = score
                        if result['ID'] not in [m['ID'] for m in all_matched_chassis]:
                            all_matched_chassis.append(result)
                if len(all_matched_chassis) >= count_needed:
                    break  
                
            search_criteria.pop(0)
            match_criteria = match_criteria - 1

        filtered_list = []
        for c in all_matched_chassis:
            filtered_list_ids = [f["ID"] for f in filtered_list]
            if c['ID'] not in filtered_list_ids:
                filtered_list.append(c)
                
        filtered_list = sorted(filtered_list, key=lambda x: x["_score"], reverse=True)
                
        return filtered_list[:count_needed]

