import { Address } from "@ton/core";
import axios from "axios";
import { ContractMetadata } from "../metadata/Metadata";

export async function fetchContractMetadata(address: Address | string, isTestnet: boolean): Promise<ContractMetadata> {
    const addressString = typeof address === 'string' ? address : address.toString({ testOnly: isTestnet });

    const url = `https://connect.tonhubapi.com/metadata/${addressString}`;

    const res = await axios.get(url);

    if (res.status === 200) {
        return res.data as ContractMetadata;
    }

    throw new Error(`Invalid response status: ${res.status} for ${addressString}`);
}