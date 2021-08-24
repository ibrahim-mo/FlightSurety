pragma solidity ^0.5.0;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    struct Airline {
        bool isRegistered;
        uint256 votes;
        uint256 ante;
    }
    mapping(address => Airline) private airlines;

    uint256 private airlineCount;

    struct FlightInsurance {
        uint256 deposit;
        uint256 refund;
    }
    // key is encoded from insuree's address and flight data
    mapping(bytes32 => FlightInsurance) private flightInsuranceMapping;

    // flightKey -> insurees
    mapping(bytes32 => address[]) private flightInsurees;

    // insuree -> flightKeys
    mapping(address => bytes32[]) private insureeFlights;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address airlineAddress
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        airlines[airlineAddress] = Airline({
            isRegistered: true,
            votes: 0,
            ante: 0
        });
        airlineCount = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }


    function isAirline
                            (
                                address airline
                            )
                            external
                            view
                            returns(bool)
    {
        return airlines[airline].isRegistered;
    }

    function isFunded
                            (
                                address airline
                            )
                            external
                            view
                            returns(bool)
    {
        return airlines[airline].ante >= 10 ether;
    }


    // Events
    event InsuranceBought(address insuree, uint256 amount);
    event InsureeCredited(address insuree, uint256 amount);
    event InsureePaid(address insuree, uint256 amount);

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (   
                                address airline,
                                address requester
                            )
                            external
                            requireIsOperational
                            returns(bool success, uint256 votes)
    {
        require(!airlines[airline].isRegistered, "Airline is already registered");
        require(airlines[requester].ante >= 10 ether, "Requester has not provided funding");

        // Up to fourth airline can be registered by a previously registered airline
        if (airlineCount < 4) {
            airlines[airline] = Airline({
                isRegistered: true,
                votes: 1,
                ante: 0
            });
            airlineCount++;
        }
        else {
            // After fourth airline, we need to have 50% votes of previously registered airlines
            if (airlines[airline].votes == 0) {
                airlines[airline] = Airline({
                    isRegistered: false,
                    votes: 1,
                    ante: 0
                });
            }
            else {
                airlines[airline].votes++;
                if ((airlineCount % 2 == 0 && airlines[airline].votes >= airlineCount / 2) ||
                    (airlineCount % 2 == 1 && airlines[airline].votes >= (airlineCount + 1) / 2))
                {
                    airlines[airline].isRegistered = true;
                    airlineCount++;
                }
            }
        }
        return (airlines[airline].isRegistered, airlines[airline].votes);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (              
                                address airline,
                                string memory flight,
                                uint256 timestamp
                            )
                            public
                            payable
                            requireIsOperational
    {
        require(msg.value > 0 && msg.value <=1 ether, "Flight insurance must be a positive value up to 1 Ether");
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        bytes32 key = keccak256(abi.encodePacked(msg.sender, flightKey));
        require(flightInsuranceMapping[key].deposit == 0, "Passenger already paid insurance for this flight");
        
        flightInsuranceMapping[key] = FlightInsurance({
            deposit: msg.value,
            refund: 0
        });
        flightInsurees[flightKey].push(msg.sender);
        insureeFlights[msg.sender].push(flightKey);

        emit InsuranceBought(msg.sender, flightInsuranceMapping[key].deposit);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp
                                )
                                public
                                requireIsOperational
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        for(uint256 i=0; i < flightInsurees[flightKey].length; i++) {
            address insuree = flightInsurees[flightKey][i];
            bytes32 key = keccak256(abi.encodePacked(insuree, flightKey));
            uint256 deposit = flightInsuranceMapping[key].deposit;
            if (deposit > 0) {
                uint256 refund = deposit * 3 / 2;
                flightInsuranceMapping[key].deposit = 0;
                flightInsuranceMapping[key].refund = refund;
                emit InsureeCredited(insuree, flightInsuranceMapping[key].refund);
            }
        }
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            requireIsOperational
    {
        uint256 totalRefund = 0;
        for (uint256 i=0; i < insureeFlights[msg.sender].length; i++) {
            bytes32 flightKey = insureeFlights[msg.sender][i];
            bytes32 key = keccak256(abi.encodePacked(msg.sender, flightKey));
            uint256 refund = flightInsuranceMapping[key].refund;
            if(refund > 0) {
                flightInsuranceMapping[key].refund = 0;
                msg.sender.transfer(refund);
                totalRefund += refund;
            }
        }
        emit InsureePaid(msg.sender, totalRefund);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                            )
                            public
                            payable
                            requireIsOperational
    {
        require(airlines[msg.sender].isRegistered, "Funder is not a registered airline");
        require(msg.value >= 10 ether, "Airline must stake 10 ether");

        airlines[msg.sender].ante = msg.value;
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}

