
namespace Hash
{
    export function Wang_U32(key: number) : number
    {
        key += ~(key << 15);
        key ^=  (key >> 10);
        key +=  (key << 3);
        key ^=  (key >> 6);
        key += ~(key << 11);
        key ^=  (key >> 16);
        return key;
    }


    export function Combine_U32(hash_a: number, hash_b: number) : number
    {
        let random_bits = 0x9E3779B9;
        hash_a ^= hash_b + random_bits + (hash_a << 6) + (hash_a >> 2);
        return hash_a;
    }
}