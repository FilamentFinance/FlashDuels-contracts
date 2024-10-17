interface IFlashDuels {
    struct Duel {
        address creator;
        string topic;
        uint256 createTime;
        uint256 startTime;
        uint256 expiryTime;
        uint256 minWager;
        DuelStatus duelStatus;
        DuelCategory category;
    }

    struct CryptoDuel {
        address creator;
        uint256 createTime;
        uint256 startTime;
        uint256 expiryTime;
        uint256 minWager;
        uint256 triggerValue;
        TriggerType triggerType;
        TriggerCondition triggerCondition;
        DuelStatus duelStatus;
    }

    function duels(string duel) external returns (Duel);
    function cryptoDuels(string cryptoDuel) external returns (CryptoDuel);
}
