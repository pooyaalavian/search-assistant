from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery
import json



class AISearchClient:
    def search_keys(self, *, extended=False, broad=False, ) -> list[dict]:
        top_search_keys = [
            {"name":"dealer", "type":"top"},
            {"name":"intended_service", "type":"top"},
            {"name":"tag_suspension", "type":"top"},
            {"name":"quarter_fenders", "type":"top"},
            {"name":"rear_suspension", "type":"top"},
            {"name":"lift_axle_location", "type":"top"},
            {"name":"wheelbase", "type":"top"},
            {"name":"c_i_non_steerable_pusher_info", "type":"top"},
            {"name":"c_i_steerable_pusher_info", "type":"top"},
            {"name":"pusher_suspension_non_steerable", "type":"top"},
            {"name":"pusher_suspension_steerable", "type":"top"},
            {"name":"def_tank_location", "type":"top"},
            {"name":"battery_box_location", "type":"top"},
            {"name":"hydraulic_tank_location", "type":"top"},
            {"name":"fuel_tank_location1", "type":"top"},
            {"name":"fuel_tank_location2", "type":"top"},
            {"name":"fuel_tank_location3", "type":"top"},
            {"name":"fuel_tank_location4", "type":"top"},
            {"name":"frame_access_steps", "type":"top"},
            {"name":"def_tank", "type":"top"},
            {"name":"battery_box", "type":"top"},
            {"name":"hydraulic_tank", "type":"top"},
            {"name":"transmission", "type":"top"},
            {"name":"fuel_tanks_add_replace1", "type":"top"},
            {"name":"fuel_tanks_add_replace2", "type":"top"},
            {"name":"fuel_tanks_add_replace3", "type":"top"},
            {"name":"fuel_tanks_add_replace4", "type":"top"},
            {"name":"exhaust_system", "type":"top"},
            ]
        broad_search_keys = [
            {"name":"unit_type","type":"broad"},
            {"name":"sleeper","type":"broad"},
            {"name":"auxillary_transmission","type":"broad"},
            {"name":"plant_location","type":"broad"},
            {"name":"chassis_year","type":"broad"},
            {"name":"base_model","type":"broad"},
        ]
        extra_search_keys = [
            {"name":"schedule_date","type":"extended"},
            {"name":"customer_name","type":"extended"},
            {"name":"air_dryer","type":"extended"},
            {"name":"air_system","type":"extended"},
            {"name":"air_tank_location","type":"extended"},
            {"name":"air_tank_options","type":"extended"},
            {"name":"battery_disconnect_switches","type":"extended"},
            {"name":"chain_hooks_hangers_box","type":"extended"},
            {"name":"driveline1","type":"extended"},
            {"name":"driveline2","type":"extended"},
            {"name":"driveline3","type":"extended"},
            {"name":"driveline4","type":"extended"},
            {"name":"fifth_wheel_setting","type":"extended"},
            {"name":"frame_access_grab_handles","type":"extended"},
            {"name":"frame_rail_size","type":"extended"},
            {"name":"fuel_fill_options","type":"extended"},
            {"name":"full_insert","type":"extended"},
            {"name":"partial_insert","type":"extended"},
            {"name":"partial_insert_location","type":"extended"},
            {"name":"defects","type":"extended"},
        ]
        
        default_search_keys = top_search_keys + broad_search_keys 
        extended_search_keys = default_search_keys + extra_search_keys
        if broad:
            return broad_search_keys
        if extended:
            return extended_search_keys
        
        return default_search_keys
    
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

    def calculate_matching_score(self, chassis1, chassis2, *, scoring_search_keys=[]) -> float:
        match_count = 0
        total_count = 0
        if len(scoring_search_keys)==0:
            scoring_search_keys = [key['name'] for key in self.search_keys()]
            
        for key in scoring_search_keys:
            if chassis1.get(key) == chassis2.get(key):
                match_count += 1
            total_count += 1
        return match_count / total_count

    def get_matching_chassis(self, chassis_id, count_needed=10) -> list[dict]:
        alg = 1
        if alg == 1:
            return self._get_matching_chassis_iterative(chassis_id, count_needed)
        else:
            return self._get_matching_chassis_vector(chassis_id, count_needed)
    
    def get_matching_chassis_custom(self, chassis_id:str, search_keys:list[dict], count_needed=10) -> list[dict]:
        mandatory=[k for k in search_keys if k['mandatory']==True]
        removeable=[k for k in search_keys if k['mandatory']==False]
        return self._get_matching_chassis_iterative(
            chassis_id, count_needed, 
            mandatory_search_keys=mandatory, 
            removeable_search_keys=removeable
        )
        
    
    def _get_matching_chassis_iterative(self, chassis_id, count_needed,*, mandatory_search_keys=[],removeable_search_keys=[]) -> list[dict]:
        chassis = self.get_chassis_by_id(chassis_id)
        if not chassis:
            return []
        
        
        scoring_search_keys = mandatory_search_criteria + removeable_search_criteria
        if len(mandatory_search_keys) ==0 and len(removeable_search_keys) == 0:
            removeable_search_keys = self.search_keys()

        all_matched_chassis = []
        mandatory_search_criteria = [ (f"{key['name']}: '{chassis[key['name']]}'",False) for key in mandatory_search_keys]
        removeable_search_criteria = [ (f"{key['name']}: '{chassis[key['name']]}'",True) for key in removeable_search_keys]
        search_criteria = mandatory_search_criteria + removeable_search_criteria
        
        def pop_first_removeable(search_criteria):
            for i in range(len(search_criteria)):
                if search_criteria[i][1]:
                    search_criteria.pop(i)
                    return search_criteria
            return None

        while search_criteria:
            search = " + ".join([x[0] for x in search_criteria])

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
                        result["_score"] = self.calculate_matching_score(
                            result, chassis, 
                            scoring_search_keys=scoring_search_keys
                        )
                        if result['ID'] not in [m['ID'] for m in all_matched_chassis]:
                            all_matched_chassis.append(result)
                if len(all_matched_chassis) >= count_needed:
                    break  
                
            search_criteria= pop_first_removeable(search_criteria)
            if search_criteria is None:
                break


        filtered_list = []
        for c in all_matched_chassis:
            filtered_list_ids = [f["ID"] for f in filtered_list]
            if c['ID'] not in filtered_list_ids:
                filtered_list.append(c)
                
        filtered_list = sorted(filtered_list, key=lambda x: x["_score"], reverse=True)
                
        return filtered_list[:count_needed]

    def _get_matching_chassis_vector(self, chassis_id, count_needed) -> list[dict]:
        chassis = self.get_chassis_by_id(chassis_id)
        if not chassis:
            return []
       
        description = chassis["description"]
 
        vector_query = VectorizableTextQuery(text=description, k_nearest_neighbors=150, fields="embedding", exhaustive=True)
 
        print(vector_query)
       
        iterator = self.search_client.search(  
            #search_text=query,  
            vector_queries= [vector_query],
            #select=["ID", "division", "dealer", "chassis_number"],
            top=150
        )  
 
        all_matched_chassis = []
        for result in iterator:  
            if result["ID"] != chassis["ID"]:
                score = self.calculate_matching_score(result, chassis)
                result["_score"] = score
                if result['ID'] not in [m['ID'] for m in all_matched_chassis]:
                            all_matched_chassis.append(result)
               
        filtered_list = sorted(all_matched_chassis, key=lambda x: x["_score"], reverse=True)
               
        return filtered_list[:count_needed]