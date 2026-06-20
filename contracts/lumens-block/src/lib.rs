#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct LumensBlockContract;

#[contractimpl]
impl LumensBlockContract {
    /// Placeholder entry point — replace with generated contract logic.
    pub fn hello(env: Env, to: Symbol) -> Symbol {
        let _ = env;
        to
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, symbol_short};

    fn setup() -> (Env, LumensBlockContractClient<'static>) {
        let env = Env::default();
        let contract_id = env.register_contract(None, LumensBlockContract);
        let client = LumensBlockContractClient::new(&env, &contract_id);
        (env, client)
    }

    #[test]
    fn test_hello_returns_symbol() {
        let (_env, client) = setup();
        assert_eq!(client.hello(&symbol_short!("world")), symbol_short!("world"));
    }

    #[test]
    fn test_hello_single_char() {
        let (_env, client) = setup();
        assert_eq!(client.hello(&symbol_short!("a")), symbol_short!("a"));
    }

    #[test]
    fn test_hello_uppercase() {
        let (_env, client) = setup();
        assert_eq!(client.hello(&symbol_short!("HELLO")), symbol_short!("HELLO"));
    }

    #[test]
    fn test_hello_alphanumeric() {
        let (_env, client) = setup();
        assert_eq!(client.hello(&symbol_short!("abc123")), symbol_short!("abc123"));
    }

    #[test]
    fn test_hello_max_length() {
        let (_env, client) = setup();
        // symbol_short! supports up to 9 characters
        assert_eq!(client.hello(&symbol_short!("abcdefghi")), symbol_short!("abcdefghi"));
    }

    #[test]
    fn test_hello_mixed_case() {
        let (_env, client) = setup();
        assert_eq!(client.hello(&symbol_short!("StellaR")), symbol_short!("StellaR"));
    }

    #[test]
    fn test_hello_is_identity() {
        // Verify the function echoes back exactly what was passed, not a transformed value
        let (_env, client) = setup();
        let input = symbol_short!("lumens");
        assert_eq!(client.hello(&input), input);
    }
}
